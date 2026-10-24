//! Cheap time-domain analysis for the reactivity visuals.
//!
//! There is no FFT here on purpose: three one-pole filters split the signal
//! into bass / mid / treble envelopes, which is all the meter, the tonearm
//! jitter, and the groove glow need. It costs a handful of multiplies per
//! sample and runs comfortably on the capture thread.

use serde::Serialize;

const BASS_HZ: f32 = 150.0;
const MID_HZ: f32 = 2_000.0;
const NOISE_FLOOR: f32 = 0.0005;
const GAIN: f32 = 6.0;
const ATTACK: f32 = 0.55;
const RELEASE: f32 = 0.12;

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Levels {
    pub level: f32,
    pub bass: f32,
    pub mid: f32,
    pub treble: f32,
}

impl Levels {
    pub(crate) const SILENT: Self = Self {
        level: 0.0,
        bass: 0.0,
        mid: 0.0,
        treble: 0.0,
    };
}

pub(crate) struct Analyzer {
    bass_alpha: f32,
    mid_alpha: f32,
    bass_state: f32,
    mid_state: f32,
    sums: [f32; 4],
    frames: usize,
    smoothed: Levels,
}

impl Analyzer {
    pub(crate) fn new(sample_rate: f32) -> Self {
        let sample_rate = sample_rate.max(8_000.0);
        Self {
            bass_alpha: one_pole_alpha(BASS_HZ, sample_rate),
            mid_alpha: one_pole_alpha(MID_HZ, sample_rate),
            bass_state: 0.0,
            mid_state: 0.0,
            sums: [0.0; 4],
            frames: 0,
            smoothed: Levels::SILENT,
        }
    }

    pub(crate) fn reset_frame(&mut self) {
        self.sums = [0.0; 4];
        self.frames = 0;
    }

    pub(crate) fn push_mono(&mut self, sample: f32) {
        let sample = sample.clamp(-1.0, 1.0);
        self.bass_state += self.bass_alpha * (sample - self.bass_state);
        self.mid_state += self.mid_alpha * (sample - self.mid_state);

        let bass = self.bass_state;
        let mid = self.mid_state - self.bass_state;
        let treble = sample - self.mid_state;

        self.sums[0] += bass * bass;
        self.sums[1] += mid * mid;
        self.sums[2] += treble * treble;
        self.sums[3] += sample * sample;
        self.frames += 1;
    }

    #[cfg_attr(not(windows), allow(dead_code))]
    pub(crate) fn push_interleaved_f32(&mut self, samples: &[f32], channels: usize) {
        let channels = channels.max(1);
        for frame in samples.chunks_exact(channels) {
            let mono = frame.iter().sum::<f32>() / channels as f32;
            self.push_mono(mono);
        }
    }

    pub(crate) fn push_interleaved_s16(&mut self, samples: &[i16], channels: usize) {
        let channels = channels.max(1);
        for frame in samples.chunks_exact(channels) {
            let mono = frame
                .iter()
                .map(|value| *value as f32 / 32768.0)
                .sum::<f32>()
                / channels as f32;
            self.push_mono(mono);
        }
    }

    /// RMS of the accumulated frame, smoothed with a fast attack and a slower
    /// release so the visuals bounce with the beat but settle without flicker.
    pub(crate) fn finish_frame(&mut self) -> Levels {
        if self.frames == 0 {
            return self.smoothed;
        }

        let scale = 1.0 / self.frames as f32;
        let target = Levels {
            level: normalize((self.sums[3] * scale).sqrt()),
            bass: normalize((self.sums[0] * scale).sqrt()),
            mid: normalize((self.sums[1] * scale).sqrt()),
            treble: normalize((self.sums[2] * scale).sqrt()),
        };

        self.smoothed = Levels {
            level: smooth(self.smoothed.level, target.level),
            bass: smooth(self.smoothed.bass, target.bass),
            mid: smooth(self.smoothed.mid, target.mid),
            treble: smooth(self.smoothed.treble, target.treble),
        };
        self.reset_frame();
        self.smoothed
    }

    #[cfg(test)]
    pub(crate) fn silence(&mut self) -> Levels {
        self.smoothed = Levels::SILENT;
        self.reset_frame();
        self.smoothed
    }
}

fn one_pole_alpha(cutoff_hz: f32, sample_rate: f32) -> f32 {
    let alpha = 1.0 - (-std::f32::consts::TAU * cutoff_hz / sample_rate).exp();
    alpha.clamp(0.0, 1.0)
}

fn normalize(rms: f32) -> f32 {
    let above_floor = (rms - NOISE_FLOOR).max(0.0);
    (above_floor * GAIN).sqrt().clamp(0.0, 1.0)
}

fn smooth(previous: f32, target: f32) -> f32 {
    let factor = if target > previous { ATTACK } else { RELEASE };
    (previous + (target - previous) * factor).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::Analyzer;

    fn run_tone(frequency: f32, amplitude: f32) -> super::Levels {
        let sample_rate = 44_100.0;
        let mut analyzer = Analyzer::new(sample_rate);
        let mut phase = 0.0_f32;
        let step = std::f32::consts::TAU * frequency / sample_rate;

        // Warm the filters up, then measure a steady frame.
        for _ in 0..20 {
            analyzer.reset_frame();
            for _ in 0..1_024 {
                analyzer.push_mono(phase.sin() * amplitude);
                phase += step;
            }
            analyzer.finish_frame();
        }

        analyzer.reset_frame();
        for _ in 0..1_024 {
            analyzer.push_mono(phase.sin() * amplitude);
            phase += step;
        }
        analyzer.finish_frame()
    }

    #[test]
    fn splits_a_low_tone_into_the_bass_band() {
        let levels = run_tone(80.0, 0.4);
        assert!(levels.bass > levels.mid, "{levels:?}");
        assert!(levels.bass > levels.treble, "{levels:?}");
        assert!(levels.level > 0.0);
    }

    #[test]
    fn splits_a_high_tone_into_the_treble_band() {
        let levels = run_tone(6_000.0, 0.4);
        assert!(levels.treble > levels.bass, "{levels:?}");
        assert!(levels.treble > levels.mid, "{levels:?}");
    }

    #[test]
    fn silence_settles_to_zero_and_is_clamped() {
        let mut analyzer = Analyzer::new(48_000.0);
        analyzer.push_mono(0.0);
        assert_eq!(analyzer.finish_frame(), super::Levels::SILENT);

        analyzer.push_mono(2.0);
        let levels = analyzer.finish_frame();
        assert!(levels.level <= 1.0 && levels.bass <= 1.0);
        assert_eq!(analyzer.silence(), super::Levels::SILENT);
    }

    #[test]
    fn interleaved_stereo_is_mixed_to_mono() {
        let mut analyzer = Analyzer::new(44_100.0);
        analyzer.push_interleaved_s16(&[16_384, 16_384, -16_384, -16_384], 2);
        assert!(analyzer.finish_frame().level > 0.0);
    }
}

//! PipeWire / PulseAudio monitor capture.
//!
//! `parec` is part of both pipewire-pulse and pulseaudio-utils, so spawning it
//! avoids a build-time dependency on libpulse headers. It streams raw s16le
//! from the default sink monitor, which is exactly the system output mix.

use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use tauri::AppHandle;

use super::dsp::Analyzer;
use super::{emit, playing};

const SAMPLE_RATE: u32 = 44_100;
const CHANNELS: usize = 2;
const EMIT_INTERVAL: Duration = Duration::from_millis(33);
const READ_BYTES: usize = 4_096;

pub(super) fn capture(app: &AppHandle) -> anyhow::Result<()> {
    let mut child = Command::new("parec")
        .args([
            "--device=@DEFAULT_MONITOR@".to_string(),
            "--format=s16le".to_string(),
            format!("--rate={SAMPLE_RATE}"),
            format!("--channels={CHANNELS}"),
            "--latency-msec=20".to_string(),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| anyhow::anyhow!("parec is unavailable ({error})"))?;

    let Some(mut stdout) = child.stdout.take() else {
        let _ = child.kill();
        return Ok(());
    };

    let mut analyzer = Analyzer::new(SAMPLE_RATE as f32);
    let mut buffer = [0_u8; READ_BYTES];
    let mut samples: Vec<i16> = Vec::with_capacity(READ_BYTES / 2);
    let mut last_emit = Instant::now() - EMIT_INTERVAL;

    loop {
        if !playing() {
            break;
        }

        match stdout.read_exact(&mut buffer) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error.into());
            }
        }

        samples.clear();
        let mut index = 0;
        while index + 1 < buffer.len() {
            samples.push(i16::from_le_bytes([buffer[index], buffer[index + 1]]));
            index += 2;
        }
        analyzer.push_interleaved_s16(&samples, CHANNELS);

        if last_emit.elapsed() >= EMIT_INTERVAL {
            emit(app, analyzer.finish_frame());
            last_emit = Instant::now();
        }
    }

    let _ = child.kill();
    let _ = child.wait();
    Ok(())
}

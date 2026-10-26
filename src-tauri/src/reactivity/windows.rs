//! WASAPI loopback capture.
//!
//! Opens the default render endpoint in shared loopback mode and reads the
//! same mix the user hears. Shared mode always gives us the device mix format,
//! which is normally 32-bit float; 16-bit PCM, 24-bit packed PCM, and 32-bit
//! integer PCM are decoded too for older or exotic drivers.

use std::slice;
use std::time::{Duration, Instant};

use tauri::AppHandle;
use windows::core::GUID;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
    AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
    WAVEFORMATEX, WAVEFORMATEXTENSIBLE,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED,
};

use super::dsp::{Analyzer, Levels};
use super::{emit, playing};

const EMIT_INTERVAL: Duration = Duration::from_millis(33);
const IDLE_SLEEP: Duration = Duration::from_millis(8);
const BUFFER_DURATION_100NS: i64 = 200_000; // 20 ms
const FORMAT_IEEE_FLOAT: u32 = 3;
const FORMAT_EXTENSIBLE: u32 = 0xFFFE;
const FORMAT_PCM: u32 = 1;

/// Extra bytes a `WAVEFORMATEXTENSIBLE` carries beyond `WAVEFORMATEX`
/// (`Samples`, `dwChannelMask`, `SubFormat`).
const EXTENSIBLE_EXTRA_BYTES: u16 = 22;

// `KSDATAFORMAT_SUBTYPE_*` lives in the Win32_Media_KernelStreaming feature,
// which this crate does not enable; the GUID values are fixed by ksmedia.h.
const SUBTYPE_PCM: GUID = GUID::from_u128(0x0000_0001_0000_0010_8000_00aa_0038_9b71);
const SUBTYPE_IEEE_FLOAT: GUID = GUID::from_u128(0x0000_0003_0000_0010_8000_00aa_0038_9b71);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SampleKind {
    F32,
    S16,
    S24Packed,
    S32,
}

impl SampleKind {
    fn bytes_per_sample(self) -> usize {
        match self {
            SampleKind::F32 | SampleKind::S32 => 4,
            SampleKind::S24Packed => 3,
            SampleKind::S16 => 2,
        }
    }
}

/// Picks the decoder for the mix format.
///
/// Shared mode normally hands us 32-bit float. Non-extensible tags use
/// `wFormatTag` directly. `FORMAT_EXTENSIBLE` defers to `SubFormat`, because
/// the tag alone cannot tell float from integer, and a 32-bit PCM subtype is
/// common in shared mode.
fn sample_kind(format: &WAVEFORMATEX) -> Option<SampleKind> {
    match format.wFormatTag as u32 {
        FORMAT_EXTENSIBLE => extensible_sample_kind(format),
        FORMAT_IEEE_FLOAT if format.wBitsPerSample == 32 => Some(SampleKind::F32),
        FORMAT_PCM => pcm_sample_kind(format.wBitsPerSample),
        _ => None,
    }
}

fn pcm_sample_kind(bits: u16) -> Option<SampleKind> {
    match bits {
        32 => Some(SampleKind::S32),
        24 => Some(SampleKind::S24Packed),
        16 => Some(SampleKind::S16),
        _ => None,
    }
}

fn extensible_sample_kind(format: &WAVEFORMATEX) -> Option<SampleKind> {
    // `cbSize` counts the bytes past the WAVEFORMATEX prefix. Without the full
    // 22 bytes there is no SubFormat to read, so do not look for one.
    if format.cbSize < EXTENSIBLE_EXTRA_BYTES {
        return None;
    }

    // SAFETY: FORMAT_EXTENSIBLE with cbSize >= 22 means the allocation is a
    // WAVEFORMATEXTENSIBLE. Both structs are repr(C, packed(1)), so the cast
    // adds no alignment requirement and SubFormat sits inside the declared
    // extra bytes.
    let extensible = unsafe { &*(format as *const WAVEFORMATEX).cast::<WAVEFORMATEXTENSIBLE>() };
    let subformat = extensible.SubFormat;
    if subformat == SUBTYPE_PCM {
        pcm_sample_kind(format.wBitsPerSample)
    } else if subformat == SUBTYPE_IEEE_FLOAT && format.wBitsPerSample == 32 {
        Some(SampleKind::F32)
    } else {
        None
    }
}

/// Turns interleaved PCM bytes into the normalized `f32` the analyzer expects.
///
/// A trailing partial sample is dropped, so a short packet tail can never
/// shift the channel layout. Values are scaled by 2^(bits-1), matching the
/// existing 16-bit path, and clamped only by the analyzer.
fn decode_to_f32(bytes: &[u8], kind: SampleKind) -> Vec<f32> {
    let width = kind.bytes_per_sample();
    bytes
        .chunks_exact(width)
        .map(|sample| match kind {
            SampleKind::F32 => f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]),
            SampleKind::S16 => i16::from_le_bytes([sample[0], sample[1]]) as f32 / 32_768.0,
            SampleKind::S24Packed => {
                // 24-bit little-endian with the sign bit in byte 2; sign-extend
                // into an i32 and divide by 2^23.
                let sign = if sample[2] & 0x80 != 0 { 0xFF } else { 0x00 };
                i32::from_le_bytes([sample[0], sample[1], sample[2], sign]) as f32 / 8_388_608.0
            }
            SampleKind::S32 => {
                i32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]) as f32
                    / 2_147_483_648.0
            }
        })
        .collect()
}

pub(super) fn capture(app: &AppHandle) -> anyhow::Result<()> {
    // SAFETY: all COM calls below run on this one thread, the mix-format
    // pointer is freed once the client has copied it, and the packet data is
    // only read between GetBuffer and ReleaseBuffer.
    unsafe { run(app) }
}

unsafe fn run(app: &AppHandle) -> anyhow::Result<()> {
    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

    let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
    let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
    let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;

    let format_ptr = client.GetMixFormat()?;
    let format: WAVEFORMATEX = *format_ptr;
    // Read the decoder choice from the full allocation: `format` only copies
    // the WAVEFORMATEX prefix, and an extensible format's SubFormat lives
    // past it.
    let kind = sample_kind(&*format_ptr);
    let initialized = client.Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
        BUFFER_DURATION_100NS,
        0,
        format_ptr,
        None,
    );
    CoTaskMemFree(Some(format_ptr as *const _));
    initialized?;

    let capture: IAudioCaptureClient = client.GetService()?;
    client.Start()?;

    let channels = format.nChannels.max(1) as usize;
    let mut analyzer = Analyzer::new(format.nSamplesPerSec.max(8_000) as f32);
    let mut last_emit = Instant::now() - EMIT_INTERVAL;

    loop {
        if !playing() {
            break;
        }

        let packet = capture.GetNextPacketSize()?;
        if packet == 0 {
            std::thread::sleep(IDLE_SLEEP);
            continue;
        }

        let mut data: *mut u8 = std::ptr::null_mut();
        let mut frames = 0_u32;
        let mut flags = 0_u32;
        if capture
            .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
            .is_err()
        {
            std::thread::sleep(IDLE_SLEEP);
            continue;
        }

        let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0;
        if !silent && !data.is_null() && frames > 0 {
            let sample_count = frames as usize * channels;
            match kind {
                Some(SampleKind::F32) => {
                    let samples = slice::from_raw_parts(data.cast::<f32>(), sample_count);
                    analyzer.push_interleaved_f32(samples, channels);
                }
                Some(SampleKind::S16) => {
                    let samples = slice::from_raw_parts(data.cast::<i16>(), sample_count);
                    analyzer.push_interleaved_s16(samples, channels);
                }
                Some(kind) => {
                    // One frame occupies `nBlockAlign` bytes; clamp to whole
                    // samples so a padded or short packet cannot read past the
                    // buffer or shift the channel layout.
                    let block_align = format.nBlockAlign as usize;
                    let byte_len =
                        (frames as usize * block_align).min(sample_count * kind.bytes_per_sample());
                    let bytes = slice::from_raw_parts(data, byte_len);
                    let samples = decode_to_f32(bytes, kind);
                    analyzer.push_interleaved_f32(&samples, channels);
                }
                None => {}
            }
        }
        capture.ReleaseBuffer(frames)?;

        if last_emit.elapsed() >= EMIT_INTERVAL {
            emit(app, analyzer.finish_frame());
            last_emit = Instant::now();
        }
    }

    let _ = client.Stop();
    emit(app, Levels::SILENT);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::Win32::Media::Audio::WAVEFORMATEXTENSIBLE_0;

    const EPSILON: f32 = 1.0e-6;

    fn assert_samples(actual: &[f32], expected: &[f32]) {
        assert_eq!(actual.len(), expected.len(), "sample count");
        for (index, (actual, expected)) in actual.iter().zip(expected).enumerate() {
            assert!(
                (actual - expected).abs() <= EPSILON,
                "sample {index}: expected {expected}, got {actual}"
            );
        }
    }

    fn pcm_format(bits: u16) -> WAVEFORMATEX {
        WAVEFORMATEX {
            wFormatTag: FORMAT_PCM as u16,
            nChannels: 2,
            nSamplesPerSec: 48_000,
            nAvgBytesPerSec: 48_000 * 2 * bits as u32 / 8,
            nBlockAlign: 2 * bits / 8,
            wBitsPerSample: bits,
            cbSize: 0,
        }
    }

    fn extensible_format(subformat: GUID, bits: u16) -> WAVEFORMATEXTENSIBLE {
        WAVEFORMATEXTENSIBLE {
            Format: WAVEFORMATEX {
                wFormatTag: FORMAT_EXTENSIBLE as u16,
                nChannels: 2,
                nSamplesPerSec: 48_000,
                nAvgBytesPerSec: 48_000 * 2 * bits as u32 / 8,
                nBlockAlign: 2 * bits / 8,
                wBitsPerSample: bits,
                cbSize: EXTENSIBLE_EXTRA_BYTES,
            },
            Samples: WAVEFORMATEXTENSIBLE_0 {
                wValidBitsPerSample: bits,
            },
            dwChannelMask: 0b11,
            SubFormat: subformat,
        }
    }

    #[test]
    fn extensible_pcm_thirty_two_bit_is_integer() {
        let format = extensible_format(SUBTYPE_PCM, 32);
        assert_eq!(sample_kind(&format.Format), Some(SampleKind::S32));
    }

    #[test]
    fn extensible_ieee_float_thirty_two_bit_stays_float() {
        let format = extensible_format(SUBTYPE_IEEE_FLOAT, 32);
        assert_eq!(sample_kind(&format.Format), Some(SampleKind::F32));
    }

    #[test]
    fn extensible_unknown_subformat_is_ignored() {
        let unknown = GUID::from_u128(0xdead_beef_0000_0010_8000_00aa_0038_9b71);
        let format = extensible_format(unknown, 32);
        assert_eq!(sample_kind(&format.Format), None);
    }

    #[test]
    fn extensible_without_subformat_bytes_is_ignored() {
        // `cbSize` says the allocation stops at the WAVEFORMATEX prefix, so
        // the code must not read a SubFormat that is not there.
        let mut format = pcm_format(32);
        format.wFormatTag = FORMAT_EXTENSIBLE as u16;
        format.cbSize = 0;
        assert_eq!(sample_kind(&format), None);
    }

    #[test]
    fn twenty_four_bit_packed_decodes_full_scale() {
        let format = pcm_format(24);
        let kind = sample_kind(&format).expect("24-bit packed PCM must decode");
        // +1.0 (0x7FFFFF), -1.0 (0x800000), +0.5 (0x400000), -0.5 (0xC00000)
        let bytes = [
            0xFF, 0xFF, 0x7F, 0x00, 0x00, 0x80, 0x00, 0x00, 0x40, 0x00, 0x00, 0xC0,
        ];
        assert_samples(&decode_to_f32(&bytes, kind), &[1.0, -1.0, 0.5, -0.5]);
    }

    #[test]
    fn thirty_two_bit_integer_decodes_full_scale() {
        let format = pcm_format(32);
        let kind = sample_kind(&format).expect("32-bit integer PCM must decode");
        let mut bytes = Vec::new();
        for value in [i32::MAX, i32::MIN, 1 << 30, -(1 << 30)] {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        assert_samples(&decode_to_f32(&bytes, kind), &[1.0, -1.0, 0.5, -0.5]);
    }

    #[test]
    fn sixteen_bit_pcm_keeps_previous_scale() {
        let format = pcm_format(16);
        let kind = sample_kind(&format).expect("16-bit PCM must decode");
        assert_eq!(kind, SampleKind::S16);
        let mut bytes = Vec::new();
        for value in [i16::MAX, i16::MIN, 16_384, -16_384] {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        assert_samples(
            &decode_to_f32(&bytes, kind),
            &[32_767.0 / 32_768.0, -1.0, 0.5, -0.5],
        );
    }

    #[test]
    fn float_mix_format_keeps_previous_mapping() {
        let mut float = pcm_format(32);
        float.wFormatTag = FORMAT_IEEE_FLOAT as u16;
        assert_eq!(sample_kind(&float), Some(SampleKind::F32));
        let mut bytes = Vec::new();
        for value in [1.0_f32, -0.25] {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        assert_samples(&decode_to_f32(&bytes, SampleKind::F32), &[1.0, -0.25]);
    }
}

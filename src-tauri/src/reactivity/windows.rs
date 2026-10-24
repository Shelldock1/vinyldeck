//! WASAPI loopback capture.
//!
//! Opens the default render endpoint in shared loopback mode and reads the
//! same mix the user hears. Shared mode always gives us the device mix format,
//! which is normally 32-bit float; 16-bit PCM is handled too for older drivers.

use std::slice;
use std::time::{Duration, Instant};

use tauri::AppHandle;
use windows::Win32::Media::Audio::{
    eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator, MMDeviceEnumerator,
    AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK,
    WAVEFORMATEX,
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
    let bits = format.wBitsPerSample;
    let is_float = matches!(
        format.wFormatTag as u32,
        FORMAT_IEEE_FLOAT | FORMAT_EXTENSIBLE
    ) && bits == 32;
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
            if is_float {
                let samples = slice::from_raw_parts(data.cast::<f32>(), sample_count);
                analyzer.push_interleaved_f32(samples, channels);
            } else if bits == 16 {
                let samples = slice::from_raw_parts(data.cast::<i16>(), sample_count);
                analyzer.push_interleaved_s16(samples, channels);
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

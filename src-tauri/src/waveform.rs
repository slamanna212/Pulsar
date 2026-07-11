use rustfft::num_complex::Complex;
use rustfft::{Fft, FftPlanner};
use std::io::ErrorKind;
use std::process::Stdio;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;
use tokio::process::{Child, Command};

const SAMPLE_RATE: u32 = 44100;
const WINDOW_SIZE: usize = 1024;
/// 8 bands, log-spaced across the audible range.
const BAND_EDGES_HZ: [f32; 9] = [20.0, 150.0, 400.0, 1000.0, 2000.0, 4000.0, 8000.0, 12000.0, 20000.0];

static STARTED: OnceLock<()> = OnceLock::new();

/// Starts a real-time spectrum analyzer once per app lifetime: captures
/// system audio output directly (not mpv's internal state - mpv's own
/// af-metadata mechanism was tested and cannot expose more than one overall
/// level, since ffmpeg's amix/merge filters drop per-branch metadata), runs
/// an FFT over a rolling window, and emits normalized per-band levels on
/// "waveform-levels". If no capture backend is available (e.g. no
/// PipeWire/PulseAudio, or on platforms without one implemented yet), this
/// silently does nothing and the frontend keeps its synthetic fallback
/// animation.
pub fn ensure_started(app: &AppHandle) {
    if STARTED.set(()).is_err() {
        return;
    }
    let app = app.clone();
    // tokio::spawn requires an active Tokio task context; ensure_started is
    // called from Tauri's synchronous .setup() closure, so it must go through
    // Tauri's own runtime handle instead.
    tauri::async_runtime::spawn(async move {
        run_capture_loop(app).await;
    });
}

#[cfg(target_os = "linux")]
async fn spawn_capture_process() -> std::io::Result<Child> {
    // This app's own dev/test environment runs PipeWire (pw-record); classic
    // PulseAudio-only systems get parec as a fallback.
    let pw_record = Command::new("pw-record")
        .args([
            "--target=@DEFAULT_AUDIO_SINK@",
            "--media-category=Capture",
            "--media-role=Music",
            &format!("--rate={SAMPLE_RATE}"),
            "--channels=1",
            "--format=s16",
            "--raw",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn();

    match pw_record {
        Ok(child) => Ok(child),
        Err(e) if e.kind() == ErrorKind::NotFound => Command::new("parec")
            .args([
                "--device=@DEFAULT_SINK@.monitor",
                &format!("--rate={SAMPLE_RATE}"),
                "--format=s16le",
                "--channels=1",
                "--raw",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true)
            .spawn(),
        Err(e) => Err(e),
    }
}

/// No loopback-capture backend implemented yet for this platform - the
/// frontend's synthetic fallback animation covers it in the meantime.
#[cfg(not(target_os = "linux"))]
async fn spawn_capture_process() -> std::io::Result<Child> {
    Err(std::io::Error::new(ErrorKind::Unsupported, "audio loopback capture not implemented on this OS"))
}

async fn run_capture_loop(app: AppHandle) {
    let mut child = match spawn_capture_process().await {
        Ok(c) => c,
        Err(e) => {
            log::warn!("waveform: no audio capture backend available ({e}) - using synthetic animation instead");
            return;
        }
    };
    let Some(mut stdout) = child.stdout.take() else {
        return;
    };

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(WINDOW_SIZE);
    let band_bins = band_bin_ranges();
    let mut byte_buf = vec![0u8; WINDOW_SIZE * 2];

    loop {
        if stdout.read_exact(&mut byte_buf).await.is_err() {
            break;
        }
        let samples: Vec<f32> = byte_buf
            .chunks_exact(2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]) as f32 / 32768.0)
            .collect();

        let levels = compute_band_levels(&samples, fft.as_ref(), &band_bins);
        let _ = app.emit("waveform-levels", levels);
    }

    let _ = child.kill().await;
}

fn band_bin_ranges() -> Vec<(usize, usize)> {
    let bin_hz = SAMPLE_RATE as f32 / WINDOW_SIZE as f32;
    let nyquist_bin = WINDOW_SIZE / 2;
    BAND_EDGES_HZ
        .windows(2)
        .map(|edge| {
            let lo = (edge[0] / bin_hz).floor() as usize;
            let hi = ((edge[1] / bin_hz).ceil() as usize).clamp(lo + 1, nyquist_bin);
            (lo.min(nyquist_bin - 1), hi)
        })
        .collect()
}

fn compute_band_levels(samples: &[f32], fft: &dyn Fft<f32>, band_bins: &[(usize, usize)]) -> Vec<f32> {
    let n = samples.len();
    let mut buffer: Vec<Complex<f32>> = samples
        .iter()
        .enumerate()
        .map(|(i, &s)| {
            let hann = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (n - 1) as f32).cos();
            Complex::new(s * hann, 0.0)
        })
        .collect();
    fft.process(&mut buffer);

    band_bins
        .iter()
        .map(|&(lo, hi)| {
            let sum: f32 = buffer[lo..hi].iter().map(|c| c.norm()).sum();
            let avg = sum / (hi - lo).max(1) as f32;
            let db = 20.0 * avg.max(1e-6).log10();
            // Rough perceptual mapping: -60dB (silent) .. 0dB (loud) -> 0..1
            ((db + 60.0) / 60.0).clamp(0.0, 1.0)
        })
        .collect()
}

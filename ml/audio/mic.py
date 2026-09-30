"""Microphone capture with pure-numpy voice-activity detection.

No C-extension VAD library is needed (webrtcvad / webrtcvad-wheels both
require MSVC on Windows and have no Python-3.14 wheels yet). A short
noise-floor calibration at the start of each recording sets an adaptive
threshold, so the detector works across different mic sensitivities without
manual tuning.

The recording pipeline:
  1. Sample ~300 ms of silence to estimate the ambient noise floor.
  2. Listen in 30-ms frames; mark each frame as speech if its RMS energy
     exceeds `noise_floor * SPEECH_RATIO`.
  3. Start capturing when the first speech frame arrives; stop after
     `silence_hangover_ms` of consecutive non-speech frames.
  4. Clip leading/trailing non-speech frames and return flat float32 PCM
     at 16 kHz, ready for WhisperSTT.transcribe.

Whisper's own `vad_filter=True` also strips silence during transcription,
so even if a frame boundary is slightly off the transcript is unaffected.
"""

from __future__ import annotations

import numpy as np

try:
    import sounddevice as sd
except ImportError:  # pragma: no cover
    sd = None  # type: ignore[assignment]

SAMPLE_RATE = 16_000
FRAME_MS = 30
FRAME_SAMPLES = SAMPLE_RATE * FRAME_MS // 1_000
SPEECH_RATIO = 3.0       # speech RMS must be > noise_floor * SPEECH_RATIO
MIN_THRESHOLD = 150.0    # absolute int16 RMS floor so very quiet rooms still work
CALIBRATION_MS = 300     # length of the initial silence sample


def record_utterance(
    max_seconds: float = 12.0,
    silence_hangover_ms: int = 900,
) -> np.ndarray:
    """Record from the default mic until the visitor stops talking (or max_seconds hit).

    Returns mono float32 PCM at 16 kHz, ready for ``WhisperSTT.transcribe``.
    An empty array is returned if nothing was recorded.
    """
    if sd is None:
        raise RuntimeError(
            "sounddevice is not installed. Run: pip install -r ml/requirements.txt"
        )

    hangover_frames = max(1, silence_hangover_ms // FRAME_MS)
    max_frames = int(max_seconds * 1_000 / FRAME_MS)
    calibration_frames = max(1, CALIBRATION_MS // FRAME_MS)

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16",
                        blocksize=FRAME_SAMPLES) as stream:

        # -- noise floor calibration ------------------------------------------
        cal_blocks: list[np.ndarray] = []
        for _ in range(calibration_frames):
            block, _ = stream.read(FRAME_SAMPLES)
            cal_blocks.append(block.reshape(-1).astype(np.float32))
        noise_rms = float(np.sqrt(np.mean(np.concatenate(cal_blocks) ** 2)))
        threshold = max(noise_rms * SPEECH_RATIO, MIN_THRESHOLD)

        # -- main recording loop -----------------------------------------------
        frames: list[np.ndarray] = []
        silence_run = 0
        speech_started = False

        for _ in range(max_frames):
            block, _ = stream.read(FRAME_SAMPLES)
            block_f = block.reshape(-1).astype(np.float32)
            frames.append(block_f)

            rms = float(np.sqrt(np.mean(block_f ** 2)))
            if rms >= threshold:
                speech_started = True
                silence_run = 0
            elif speech_started:
                silence_run += 1
                if silence_run >= hangover_frames:
                    break

    if not frames or not speech_started:
        return np.zeros(0, dtype=np.float32)

    pcm = np.concatenate(frames) / 32_768.0   # int16 -> float32 [-1, 1]
    return pcm.astype(np.float32)

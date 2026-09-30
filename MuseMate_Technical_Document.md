# MuseMate: Technical Architecture & System Overview

## 1. Introduction
MuseMate is an offline-first, handheld museum guide system designed to replace traditional placards and audio tours. Visitors interact with the system by tapping an NFC tag on an artifact to hear its story in their preferred language, followed by the ability to ask questions verbally. 

The system operates entirely on a local edge server to ensure privacy and function without requiring an internet connection.

## 2. System Architecture
The MuseMate ecosystem is divided into three primary components:

### 2.1. Handheld Device (Hardware)
- **Microcontroller**: ESP32-S3
- **Components**: PN532 NFC reader, I2S microphone and speaker, push-to-talk button, and a microSD cache.
- **Function**: Acts as a thin client. Reads NFC tags (representing artifacts or waypoints) and streams audio (speech-to-text queries) to the edge server over the museum's local WiFi.

### 2.2. Edge Server (Backend)
- **Framework**: FastAPI (Python)
- **Database**: SQLite (SQLAlchemy ORM)
- **Role**: Manages visitor sessions, maintains the catalog, processes NFC taps, and handles the WebSocket API for live dashboard telemetry.
- **ML Subsystem (Local Inference)**:
  - **LLM**: Qwen 3.5:4b (via Ollama) for generating context-aware, RAG-grounded answers to visitor questions.
  - **Speech-to-Text (STT)**: `faster-whisper` (`medium` model) for fast CPU-optimized transcription.
  - **Text-to-Speech (TTS)**: AI4Bharat `indic-parler-tts` for 8 Indian languages + English, and `Piper` for European fallback languages (French/German).

### 2.3. Curator Dashboard
- **Framework**: React 19, Vite, TypeScript, Tailwind CSS 4, Recharts.
- **Role**: Real-time monitoring of visitor engagement, dwell times, and questions asked. Allows curators to update artifact details dynamically based on "pain points" (e.g., frequently unanswered questions).

## 3. Database Schema (SQLite)
The edge server relies on a relational SQLite database to track sessions and artifacts without storing PII (Personally Identifiable Information).

- **`SESSION`**: Tracks an anonymous visit (`id`, `lang`, `mode`, `startedAt`, `endedAt`).
- **`ARTIFACT`**: The catalog entry (`accession`, `nfcTag`, `name`, `description`, `curatorNotes`).
- **`STOP`**: Represents a visitor dwelling at a specific artifact (`artifactId`, `dwellSec`, `listenedPct`, `skipped`).
- **`QUERY`**: Tracks questions asked at a stop (`text`, `topic`, `status`, `latencyMs`).
- **`REVIEW`**: End-of-visit ratings (`rating`, `text`).
- **`GALLERY`**: Logical grouping of artifacts.

## 4. Latency Considerations
Since the entire pipeline (STT -> LLM -> TTS) runs locally on the museum's edge server, managing latency is critical for a conversational experience:
- **STT Latency**: Addressed by using `faster-whisper`, which achieves decent real-time factors even on CPU.
- **LLM Latency**: Qwen 3.5:4b is a quantized model running on `llama.cpp` (via Ollama), prioritizing time-to-first-token.
- **TTS Latency**: Piper is used for fallback languages due to its tiny, fast ONNX models. Indic Parler-TTS is used for Indian languages; optimizing its batch size and caching is necessary to prevent long audio generation delays.
- **Network Latency**: Negligible, as everything operates on a local LAN/WiFi.

## 5. Pros and Cons

### Pros
1. **Offline & Resilient**: Fully functional in areas with poor or zero cellular reception (e.g., thick-walled historical buildings).
2. **Privacy Preserving**: No PII or visitor audio is persisted or sent to the cloud. Visitors are just anonymous session IDs.
3. **Accessibility**: Highly inclusive for visually impaired visitors, children, and non-native speakers.
4. **Rich Telemetry**: Museums gain unprecedented insights into artifact engagement and visitor curiosity through the dashboard.
5. **No Apps Required**: Visitors don't need to download an app or use their own battery/data.

### Cons
1. **Hardware Limitations**: ESP32-S3 has limited processing power and memory, requiring careful management of audio streaming buffers.
2. **Local LLM Constraints**: A 4-billion parameter model (Qwen 3.5:4b) cannot match the reasoning capabilities or deep factual recall of massive cloud models (like GPT-4). It relies heavily on strict RAG context from the catalog.
3. **Compute Requirements**: The edge server needs a capable machine (ideally with a GPU) to run STT, LLM, and TTS concurrently for multiple visitors without degrading latency.
4. **Heuristic Limitations**: Topic routing relies on keyword heuristics rather than semantic matching, which may misclassify nuanced questions.

## 6. Conclusion
MuseMate provides a modern, scalable, and privacy-first solution to museum tours. By localizing compute and leaning on edge AI, it bridges the gap between static placards and expensive human guides, while equipping curators with actionable data.

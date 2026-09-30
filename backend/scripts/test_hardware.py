import asyncio
import json
import wave
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

app = FastAPI()

@app.websocket("/kiosk/ws")
async def test_ws(websocket: WebSocket):
    await websocket.accept()
    print("========================================")
    print("ESP32 Connected! Testing hardware...")
    print("========================================")

    # Automatically start streaming the music to test the MAX98357A speaker!
    asyncio.create_task(play_music(websocket))

    audio_buffer = bytearray()

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                audio_buffer.extend(message["bytes"])
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                except Exception:
                    continue
                
                if data.get("type") == "ptt_start":
                    print("\n[MIC] PTT pressed! Recording audio...")
                    audio_buffer.clear()
                elif data.get("type") == "ptt_end":
                    print(f"[MIC] PTT released! Saving {len(audio_buffer)} bytes to test_recording.wav...")
                    if len(audio_buffer) > 0:
                        save_wav("test_recording.wav", audio_buffer)
                        print("[MIC] -> Saved to test_recording.wav successfully! You can listen to it on your laptop.")
                    else:
                        print("[MIC] -> Warning: No audio received! Check your INMP441 wiring.")
                elif data.get("type") == "rfid":
                    print(f"\n[RFID] Scanned UID: {data.get('uid')}")
    except WebSocketDisconnect:
        print("\nESP32 Disconnected!")


async def play_music(websocket: WebSocket):
    if not os.path.exists("test_music.wav"):
        print("[SPEAKER] test_music.wav not found! Skipping music test.")
        return
        
    try:
        with wave.open("test_music.wav", "rb") as wf:
            print(f"[SPEAKER] Streaming YouTube music to ESP32 (Sample Rate: {wf.getframerate()}Hz)...")
            chunk_size = 4096
            while True:
                data = wf.readframes(chunk_size // 2) # 16-bit audio
                if not data:
                    break
                
                try:
                    await websocket.send_bytes(data)
                except Exception:
                    break # WebSocket closed
                    
                await asyncio.sleep(0.01) # Small delay to not overwhelm the ESP32
            print("[SPEAKER] Music finished playing.")
    except Exception as e:
        print(f"[SPEAKER] Music streaming stopped.")

def save_wav(filename, pcm_data):
    with wave.open(filename, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2) # 16-bit
        wf.setframerate(16000)
        wf.writeframes(pcm_data)

if __name__ == "__main__":
    print("Starting Hardware Test Server...")
    print("Press CTRL+C to stop.")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

/**
 * kiosk_wifi.ino
 *
 * ESP32 Smart Museum Guide with INMP441 (Mic), MAX98357A (Speaker), 
 * Touch Button (Push-to-Talk), and RC522 (RFID).
 *
 * This connects to WiFi and streams audio to/from the Python backend
 * using WebSockets.
 *
 * REQUIRES ARDUINO LIBRARIES:
 * 1. WebSockets by Markus Sattler (v2.4.1 or later)
 * 2. MFRC522 by GithubCommunity
 * 3. Arduino_JSON (optional, we'll just format manually)
 *
 * HARDWARE WIRING:
 * ────────────────
 * RC522 RFID module (SPI)
 *   3.3V  → 3V3
 *   GND   → GND
 *   SCK   → GPIO 18
 *   MISO  → GPIO 19
 *   MOSI  → GPIO 23
 *   SDA   → GPIO 17
 *   RST   → GPIO 16
 *
 * HW-763 capacitive touch module (TTP223)
 *   VCC   → 3V3
 *   GND   → GND
 *   SIG   → GPIO 4
 *
 * INMP441 Microphone (I2S RX)
 *   VDD   → 3V3
 *   GND   → GND
 *   L/R   → GND (Left channel)
 *   WS    → GPIO 25
 *   SCK   → GPIO 26
 *   SD    → GPIO 33
 *
 * MAX98357A Amplifier (I2S TX)
 *   VIN   → 5V (or 3V3)
 *   GND   → GND
 *   LRC   → GPIO 22
 *   BCLK  → GPIO 21
 *   DIN   → GPIO 27
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>
#include <SPI.h>
#include <MFRC522.h>

// ─── NETWORK SETTINGS ────────────────────────────────────────────────────────
const char* ssid     = "hotspot";
const char* password = "password";
// The IP address of your laptop running the Python FastAPI backend
const char* ws_host  = "10.181.118.99"; 
const int   ws_port  = 8000;
const char* ws_path  = "/kiosk/ws";

// ─── PIN DEFINITIONS ─────────────────────────────────────────────────────────
// RFID
#define RC522_SS  17
#define RC522_RST 16
// Touch
#define TOUCH_PIN 4
// Mic (INMP441) on I2S_NUM_1
#define I2S_MIC_WS   25
#define I2S_MIC_SCK  26
#define I2S_MIC_SD   33
// Speaker (MAX98357A) on I2S_NUM_0
#define I2S_SPK_WS   22
#define I2S_SPK_BCLK 21
#define I2S_SPK_DIN  27

// ─── GLOBALS ─────────────────────────────────────────────────────────────────
WebSocketsClient webSocket;
MFRC522 rfid(RC522_SS, RC522_RST);

String lastUid = "";
unsigned long lastScanMs = 0;

bool pttActive = false;
bool pttRawLast = false;
uint8_t pttRawCount = 0;
unsigned long pttLastPollMs = 0;

// Audio Buffer
#define AUDIO_BUFFER_SIZE 1024
uint8_t micBuffer[AUDIO_BUFFER_SIZE];

// ─── I2S SETUP ───────────────────────────────────────────────────────────────
void setupI2S() {
  // 1. Setup Speaker (TX) on I2S_NUM_0
  i2s_config_t i2s_spk_config = {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
      .sample_rate = 16000,
      .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
      .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
      .communication_format = I2S_COMM_FORMAT_STAND_I2S,
      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
      .dma_buf_count = 8,
      .dma_buf_len = 1024,
      .use_apll = false,
      .tx_desc_auto_clear = true,
      .fixed_mclk = 0
  };
  
  i2s_pin_config_t pin_spk_config = {
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(4, 4, 0)
      .mck_io_num = I2S_PIN_NO_CHANGE,
#endif
      .bck_io_num = I2S_SPK_BCLK,
      .ws_io_num = I2S_SPK_WS,
      .data_out_num = I2S_SPK_DIN,
      .data_in_num = I2S_PIN_NO_CHANGE
  };
  
  i2s_driver_install(I2S_NUM_0, &i2s_spk_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_spk_config);
  i2s_zero_dma_buffer(I2S_NUM_0);

  // 2. Setup Mic (RX) on I2S_NUM_1
  i2s_config_t i2s_mic_config = {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
      .sample_rate = 16000,
      .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT, // INMP441 MUST have 32-bit clocks to work properly!
      .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
      .communication_format = I2S_COMM_FORMAT_STAND_I2S,
      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
      .dma_buf_count = 8,
      .dma_buf_len = 1024,
      .use_apll = false,
      .tx_desc_auto_clear = false,
      .fixed_mclk = 0
  };
  
  i2s_pin_config_t pin_mic_config = {
#if ESP_IDF_VERSION >= ESP_IDF_VERSION_VAL(4, 4, 0)
      .mck_io_num = I2S_PIN_NO_CHANGE,
#endif
      .bck_io_num = I2S_MIC_SCK,
      .ws_io_num = I2S_MIC_WS,
      .data_out_num = I2S_PIN_NO_CHANGE,
      .data_in_num = I2S_MIC_SD
  };
  
  i2s_driver_install(I2S_NUM_1, &i2s_mic_config, 0, NULL);
  i2s_set_pin(I2S_NUM_1, &pin_mic_config);
}

// ─── WEBSOCKET EVENT HANDLER ─────────────────────────────────────────────────
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected!");
      break;
    case WStype_CONNECTED:
      Serial.println("[WS] Connected to backend!");
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Received text: %s\n", payload);
      break;
    case WStype_BIN:
      // Binary data received -> play on Speaker!
      size_t bytesWritten;
      i2s_write(I2S_NUM_0, payload, length, &bytesWritten, portMAX_DELAY);
      break;
  }
}

// ─── HELPER: Convert RFID UID to String ──────────────────────────────────────
String getUidString() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; ++i) {
    if (i > 0) uid += ":";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ─── MAIN SETUP ──────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(TOUCH_PIN, INPUT);

  // Init SPI & RFID
  SPI.begin(18, 19, 23, 17);
  rfid.PCD_Init();
  delay(10);
  Serial.println("RFID Ready.");

  // Init Audio
  setupI2S();
  Serial.println("I2S Audio Ready.");

  // Connect WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected! IP: ");
  Serial.println(WiFi.localIP());

  // Connect WebSocket
  webSocket.begin(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

// ─── MAIN LOOP ───────────────────────────────────────────────────────────────
void loop() {
  webSocket.loop();
  
  unsigned long now = millis();

  // 1. Poll Touch Button (Debounced)
  if (now - pttLastPollMs >= 10) {
    pttLastPollMs = now;
    bool raw = (digitalRead(TOUCH_PIN) == HIGH);
    
    if (raw == pttRawLast) {
      if (pttRawCount < 4) pttRawCount++;
    } else {
      pttRawLast = raw;
      pttRawCount = 1;
    }

    if (pttRawCount >= 4 && raw != pttActive) {
      pttActive = raw;
      if (pttActive) {
        Serial.println("PTT Pressed");
        webSocket.sendTXT("{\"type\":\"ptt_start\"}");
      } else {
        Serial.println("PTT Released");
        webSocket.sendTXT("{\"type\":\"ptt_end\"}");
      }
    }
  }

  // 2. Read Microphone Audio if PTT is active
  if (pttActive) {
    size_t bytesRead = 0;
    int32_t rawSamples[128]; 
    i2s_read(I2S_NUM_1, &rawSamples, sizeof(rawSamples), &bytesRead, 10);
    
    if (bytesRead > 0) {
      int numSamples = bytesRead / 4;
      int16_t outSamples[128];
      for (int i = 0; i < numSamples; i++) {
        // INMP441 data is MSB-aligned in the 32-bit word. 
        // We take the top 16 bits to get standard 16-bit PCM.
        outSamples[i] = (int16_t)(rawSamples[i] >> 16); 
      }
      // Send binary audio frame to backend!
      webSocket.sendBIN((uint8_t*)outSamples, numSamples * 2);
    }
  }

  // 3. Poll RFID (Only if not recording audio to prevent SPI blocking)
  if (!pttActive && rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = getUidString();
    if (uid != lastUid || (now - lastScanMs) >= 2500) {
      Serial.printf("RFID Scanned: %s\n", uid.c_str());
      
      String payload = "{\"type\":\"rfid\", \"uid\":\"" + uid + "\"}";
      webSocket.sendTXT(payload);
      
      lastUid = uid;
      lastScanMs = now;
    }
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }
}

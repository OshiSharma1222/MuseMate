/**
 * rfid_ptt.ino
 *
 * MuseMate ESP32 firmware — RFID reader + Push-to-Talk button
 *
 * Hardware wiring
 * ───────────────
 * RC522 RFID module (SPI)
 *   3.3V  → 3V3
 *   GND   → GND
 *   SCK   → GPIO 18
 *   MISO  → GPIO 19
 *   MOSI  → GPIO 23
 *   SDA   → GPIO 17  (SS / NSS / SDA pin on the module)
 *   RST   → GPIO 16
 *
 * HW-763 capacitive touch module (TTP223 / generic one-wire)
 *   VCC   → 3V3
 *   GND   → GND
 *   SIG   → GPIO 4   (active-HIGH: HIGH = finger on pad)
 *
 * Serial protocol (115200 baud, consumed by the Python back-end)
 * ───────────────────────────────────────────────────────────────
 *   READY,RFID_PTT,1              – sent once on boot
 *   MFRC522_VERSION,<hex>         – firmware version of the RC522 chip
 *   TAG,<UID>,<PICC type>         – RFID card / fob detected
 *   ERROR,READ_FAILED             – card present but serial read failed
 *   PTT_PRESS                     – touch pad just pressed
 *   PTT_RELEASE                   – touch pad just released
 */

#include <SPI.h>
#include <MFRC522.h>

// ── RC522 pin map ──────────────────────────────────────────────────────────
static constexpr uint8_t RC522_SS   = 17;
static constexpr uint8_t RC522_RST  = 16;
static constexpr uint8_t SPI_SCK    = 18;
static constexpr uint8_t SPI_MISO   = 19;
static constexpr uint8_t SPI_MOSI   = 23;

// ── HW-763 touch module pin ────────────────────────────────────────────────
// The TTP223-based HW-763 outputs a stable HIGH while the pad is touched.
// Connect SIG to GPIO 4 (any digital input works; avoid SPI / UART pins).
static constexpr uint8_t TOUCH_PIN  = 4;

// ── RFID de-bounce ─────────────────────────────────────────────────────────
static constexpr unsigned long RESCAN_DELAY_MS = 2500;

// ── PTT de-bounce ──────────────────────────────────────────────────────────
// How many consecutive same-state reads before we accept the transition.
static constexpr uint8_t  PTT_DEBOUNCE_COUNT = 4;
static constexpr uint16_t PTT_POLL_MS        = 10;   // ms between reads

MFRC522 rfid(RC522_SS, RC522_RST);

String        lastUid;
unsigned long lastScanMs = 0;

// PTT state machine
bool          pttActive       = false;  // current confirmed state
uint8_t       pttRawCount     = 0;      // consecutive same raw reads
bool          pttRawLast      = false;  // last raw reading
unsigned long pttLastPollMs   = 0;

// ── helpers ────────────────────────────────────────────────────────────────

String uidString() {
  String uid;
  uid.reserve(rfid.uid.size * 3);
  for (byte i = 0; i < rfid.uid.size; ++i) {
    if (i > 0) uid += ':';
    if (rfid.uid.uidByte[i] < 0x10) uid += '0';
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ── setup ──────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);

  // Touch pin – input only, no pull-up (HW-763 drives the line itself)
  pinMode(TOUCH_PIN, INPUT);

  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, RC522_SS);
  rfid.PCD_Init();
  delay(10);

  Serial.println("READY,RFID_PTT,1");
  Serial.print("MFRC522_VERSION,");
  Serial.println(rfid.PCD_ReadRegister(MFRC522::VersionReg), HEX);
}

// ── PTT polling (called every loop iteration) ──────────────────────────────

void pollTouch() {
  const unsigned long now = millis();
  if ((now - pttLastPollMs) < PTT_POLL_MS) return;
  pttLastPollMs = now;

  const bool raw = (digitalRead(TOUCH_PIN) == HIGH);

  if (raw == pttRawLast) {
    if (pttRawCount < PTT_DEBOUNCE_COUNT) ++pttRawCount;
  } else {
    pttRawLast  = raw;
    pttRawCount = 1;
  }

  if (pttRawCount >= PTT_DEBOUNCE_COUNT && raw != pttActive) {
    pttActive = raw;
    Serial.println(pttActive ? "PTT_PRESS" : "PTT_RELEASE");
    
    // Human-readable message for the Arduino Serial Monitor
    if (pttActive) {
      Serial.println("INFO,Touch button is pressed");
    } else {
      Serial.println("INFO,Touch button is released");
    }
  }
}

// ── RFID polling ───────────────────────────────────────────────────────────

void pollRfid() {
  if (!rfid.PICC_IsNewCardPresent()) return;

  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  const String uid = uidString();
  const unsigned long now = millis();

  if (uid != lastUid || (now - lastScanMs) >= RESCAN_DELAY_MS) {
    MFRC522::PICC_Type type = rfid.PICC_GetType(rfid.uid.sak);
    Serial.print("TAG,");
    Serial.print(uid);
    Serial.print(',');
    Serial.println(rfid.PICC_GetTypeName(type));

    lastUid    = uid;
    lastScanMs = now;
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  delay(50);
}

// ── main loop ──────────────────────────────────────────────────────────────

void loop() {
  pollTouch();
  pollRfid();
  delay(10);
}

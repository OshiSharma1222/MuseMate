#include <SPI.h>
#include <MFRC522.h>

// --- RFID Pins ---
#define RC522_SS   17
#define RC522_RST  16
#define SPI_SCK    18
#define SPI_MISO   19
#define SPI_MOSI   23

// --- Touch Sensor Pin ---
#define TOUCH_PIN  4

MFRC522 rfid(RC522_SS, RC522_RST);
bool lastTouchState = false;

void setup() {
  Serial.begin(115200);
  // Wait a moment for serial to open
  delay(1000); 
  
  Serial.println("\n--- Minimal Sensor Test Started ---");

  // 1. Initialize Touch Sensor
  pinMode(TOUCH_PIN, INPUT);

  // 2. Initialize RFID
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, RC522_SS);
  rfid.PCD_Init();
  
  Serial.println("Ready! Place your finger on the touch sensor or scan an RFID tag...");
}

void loop() {
  // ==========================================
  // 1. CHECK TOUCH SENSOR
  // ==========================================
  bool currentTouchState = digitalRead(TOUCH_PIN);
  
  if (currentTouchState != lastTouchState) {
    lastTouchState = currentTouchState;
    if (currentTouchState) {
      Serial.println("-> Touch button PRESSED!");
    } else {
      Serial.println("-> Touch button RELEASED!");
    }
    delay(50); // Small, simple delay for debounce
  }

  // ==========================================
  // 2. CHECK RFID SCANNER
  // ==========================================
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("-> RFID Tag Scanned! UID:");
    
    // Print the UID in hex
    for (byte i = 0; i < rfid.uid.size; i++) {
      Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
      Serial.print(rfid.uid.uidByte[i], HEX);
    }
    Serial.println();
    
    // Halt the card so it doesn't read continuously at full speed
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    
    delay(1000); // Wait 1 second before reading another tag to avoid spamming
  }
}

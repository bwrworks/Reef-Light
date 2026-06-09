/*
 * Creators Aquarium Reef Light Controller v1.2
 * ESP32 Firmware — synced with Reef Light Web UI
 * Channels: UV+Red, Blue A, Blue B, White, Fan (full always)
 * Features: WiFi, Web Server, Sunrise/Sunset, Auto-reconnect, Cloud MQTT
 *
 * WIRING:
 *   PIN 32 → UV+Red driver PWM input
 *   PIN 27 → Blue A driver PWM input
 *   PIN 26 → Blue B driver PWM input
 *   PIN 25 → White driver PWM input
 *   PIN 33 → Fan driver PWM input
 *   All driver GND → ESP32 GND
 *
 * DRIVER NOTE: Flyrobo constant current drivers are ACTIVE-LOW.
 *   PWM 0   = full brightness (driver fully on)
 *   PWM 255 = fully off (driver off)
 *   applyChannels() handles inversion automatically.
 *
 * current.* stores logical 0-255 (0=off, 255=full bright).
 * applyChannels() inverts before writing to hardware.
 *
 * MQTT Commands from Web UI (cmd_type field):
 *   "get_state"  → ESP32 immediately publishes full state JSON
 *   "channels"   → Set uvRed, blueA, blueB, white (0-255) + enables manual override
 *   "schedule"   → Set all schedule fields + saves to NVS flash + applies immediately
 *   "power"      → on: true/false — master power toggle
 *   "auto"       → Disable manual override, resume sunrise/sunset schedule
 *   "manual"     → Enable manual override flag (channels follow next "channels" cmd)
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include <ESPmDNS.h>
#include <WiFiManager.h>
#include <PubSubClient.h>

// ─── CLOUD MQTT ─────────────────────────────────────────────────────
const char* mqtt_server      = "broker.hivemq.com";
const int   mqtt_port        = 1883;
const char* mqtt_topic_cmd   = "creatorsreef/cmd/cr-849a2bf1-9c32-4d51-a719-21b9a8f4d91e";
const char* mqtt_topic_state = "creatorsreef/state/cr-849a2bf1-9c32-4d51-a719-21b9a8f4d91e";

// ─── MQTT BUFFER ────────────────────────────────────────────────────
// State JSON can be 600-800 bytes; commands up to 200 bytes.
// Set to 1024 to safely handle both without truncation.
#define MQTT_BUFFER_SIZE 1024

WiFiClient   espClient;
PubSubClient mqttClient(espClient);
uint32_t     lastMqttPublish = 0;
bool         stateChanged    = false;

#define MAX_LOGS 5
String sysLogs[MAX_LOGS];
int logIndex = 0;

void addLog(String msg) {
  struct tm t;
  String ts = "";
  if (getLocalTime(&t)) {
    char timeBuf[10];
    strftime(timeBuf, sizeof(timeBuf), "%H:%M", &t);
    ts = String(timeBuf) + " ";
  } else {
    ts = String(millis()/1000) + "s ";
  }
  sysLogs[logIndex] = ts + msg;
  logIndex = (logIndex + 1) % MAX_LOGS;
  Serial.println("LOG: " + msg);
  stateChanged = true;
}

// ─── PINS ───────────────────────────────────────────────────────────
#define PIN_UV_RED  32
#define PIN_BLUE_A  27
#define PIN_BLUE_B  26
#define PIN_WHITE   25
#define PIN_FAN     33

// ─── PWM ────────────────────────────────────────────────────────────
#define PWM_FREQ  1000   // 1kHz for LEDs
#define PWM_RES   8      // 8-bit (0-255)
#define FAN_PWM_FREQ 25000 // 25kHz for silent fan speed control

// ─── NTP ────────────────────────────────────────────────────────────
const char* NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET = 19800;   // IST = UTC+5:30
const int   DST_OFFSET = 0;

// ─── GLOBALS ────────────────────────────────────────────────────────
WebServer  server(80);
Preferences prefs;
String deviceName = "CreatorsReef ESP32";

// Logical channel values: 0 = off, 255 = full brightness
struct ChannelState {
  uint8_t uvRed = 0;
  uint8_t blueA = 0;
  uint8_t blueB = 0;
  uint8_t white = 0;
};
ChannelState current;

struct Schedule {
  bool     enabled     = true;
  uint8_t  sunriseHour = 7;
  uint8_t  sunriseMin  = 0;
  uint8_t  sunsetHour  = 20;
  uint8_t  sunsetMin   = 0;
  uint16_t rampMinutes = 60;
  uint8_t  peakBlue    = 85;   // 0-100%
  uint8_t  peakWhite   = 40;
  uint8_t  peakUvRed   = 25;
};
Schedule schedule;

bool     globalPower    = true;
bool     manualOverride = false;
uint8_t  fanSpeed       = 100;  // 0-100% (user-controlled), default full speed
uint32_t lastWifiCheck  = 0;
bool     timesynced     = false;

// ─── CHANNEL OUTPUT ─────────────────────────────────────────────────

// Writes logical 0-255 values to hardware, inverted for active-low drivers
void applyChannels() {
  if (!globalPower) {
    ledcWrite(PIN_UV_RED, 255);
    ledcWrite(PIN_BLUE_A, 255);
    ledcWrite(PIN_BLUE_B, 255);
    ledcWrite(PIN_WHITE,  255);
    return;
  }
  ledcWrite(PIN_UV_RED, 255 - current.uvRed);
  ledcWrite(PIN_BLUE_A, 255 - current.blueA);
  ledcWrite(PIN_BLUE_B, 255 - current.blueB);
  ledcWrite(PIN_WHITE,  255 - current.white);
}

// Set fan PWM from 0-100% (active-low: 0%=off, 100%=full speed)
void applyFan() {
  // User speed 0% → PWM 255 (active-low = off)
  // User speed 100% → PWM 0 (active-low = full on)
  ledcWrite(PIN_FAN, 255 - (fanSpeed * 255 / 100));
}

void allOff() {
  current.uvRed = 0;
  current.blueA = 0;
  current.blueB = 0;
  current.white = 0;
  applyChannels();
}

// ─── PREFS ──────────────────────────────────────────────────────────

void savePrefs() {
  prefs.begin("reef", false);
  prefs.putBool("schedEnabled", schedule.enabled);
  prefs.putUChar("srHour",      schedule.sunriseHour);
  prefs.putUChar("srMin",       schedule.sunriseMin);
  prefs.putUChar("ssHour",      schedule.sunsetHour);
  prefs.putUChar("ssMin",       schedule.sunsetMin);
  prefs.putUShort("ramp",       schedule.rampMinutes);
  prefs.putUChar("peakBlue",    schedule.peakBlue);
  prefs.putUChar("peakWhite",   schedule.peakWhite);
  prefs.putUChar("peakUvRed",   schedule.peakUvRed);
  prefs.putBool("power",        globalPower);
  prefs.putUChar("fanSpeed",    fanSpeed);
  prefs.end();
}

void loadPrefs() {
  prefs.begin("reef", true);
  schedule.enabled     = prefs.getBool("schedEnabled", true);
  schedule.sunriseHour = prefs.getUChar("srHour",      7);
  schedule.sunriseMin  = prefs.getUChar("srMin",       0);
  schedule.sunsetHour  = prefs.getUChar("ssHour",      20);
  schedule.sunsetMin   = prefs.getUChar("ssMin",       0);
  schedule.rampMinutes = prefs.getUShort("ramp",       60);
  schedule.peakBlue    = prefs.getUChar("peakBlue",    85);
  schedule.peakWhite   = prefs.getUChar("peakWhite",   40);
  schedule.peakUvRed   = prefs.getUChar("peakUvRed",   25);
  globalPower          = prefs.getBool("power",        true);
  fanSpeed             = prefs.getUChar("fanSpeed",     100);
  prefs.end();
}

// ─── SCHEDULE ───────────────────────────────────────────────────────

// Converts percentage 0-100 to logical PWM 0-255 (linear)
static inline uint8_t pctToRaw(float pct) {
  return (uint8_t)((pct / 100.0f) * 255.0f);
}

void runSchedule() {
  if (!schedule.enabled || !timesynced || manualOverride) return;

  struct tm t;
  if (!getLocalTime(&t)) return;

  int nowMins     = t.tm_hour * 60 + t.tm_min;
  int sunriseMins = schedule.sunriseHour * 60 + schedule.sunriseMin;
  int sunsetMins  = schedule.sunsetHour  * 60 + schedule.sunsetMin;
  int ramp        = schedule.rampMinutes;

  float blueF = 0, whiteF = 0, uvRedF = 0;

  if (nowMins < sunriseMins || nowMins >= (sunsetMins + ramp)) {
    // Night — all off
    blueF = whiteF = uvRedF = 0;

  } else if (nowMins < sunriseMins + ramp) {
    // Sunrise ramp up
    float progress = (float)(nowMins - sunriseMins) / ramp;
    blueF  = progress * schedule.peakBlue;
    whiteF = progress * schedule.peakWhite;
    uvRedF = progress * schedule.peakUvRed;

  } else if (nowMins < sunsetMins) {
    // Midday peak
    blueF  = schedule.peakBlue;
    whiteF = schedule.peakWhite;
    uvRedF = schedule.peakUvRed;

  } else if (nowMins < sunsetMins + ramp) {
    // Sunset ramp down
    float progress = 1.0f - (float)(nowMins - sunsetMins) / ramp;
    blueF  = progress * schedule.peakBlue;
    whiteF = progress * schedule.peakWhite;
    uvRedF = progress * schedule.peakUvRed;
  }

  current.blueA = pctToRaw(blueF);
  current.blueB = pctToRaw(blueF);
  current.white = pctToRaw(whiteF);
  current.uvRed = pctToRaw(uvRedF);
  applyChannels();
}

// ─── WIFI ───────────────────────────────────────────────────────────

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFiManager wm;
  // wm.resetSettings(); // uncomment to clear saved credentials

  Serial.println("Starting WiFiManager...");
  bool res = wm.autoConnect("ReefLight_Setup");

  if (!res) {
    Serial.println("WiFi connection failed");
    addLog("WiFi connection failed");
  } else {
    Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
    addLog("WiFi connected");
    configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
    struct tm t;
    if (getLocalTime(&t, 5000)) {
      timesynced = true;
      Serial.println("Time synced");
      addLog("Time synced");
    } else {
      addLog("Time sync failed");
    }
    if (MDNS.begin("reef")) {
      MDNS.addService("http", "tcp", 80);
      Serial.println("mDNS: http://reef.local");
    }
  }
}

// ─── JSON HELPERS ───────────────────────────────────────────────────

String buildStateJson() {
  struct tm t;
  bool hasTime = getLocalTime(&t);
  char timeBuf[20] = "N/A";
  if (hasTime) strftime(timeBuf, sizeof(timeBuf), "%H:%M:%S", &t);

  // Build JSON manually to stay within MQTT_BUFFER_SIZE.
  // Keep log strings short (trimmed to 30 chars each).
  String json = "{";
  json += "\"name\":\"" + deviceName + "\",";
  json += "\"uvRed\":"  + String(current.uvRed)  + ",";
  json += "\"blueA\":"  + String(current.blueA)  + ",";
  json += "\"blueB\":"  + String(current.blueB)  + ",";
  json += "\"white\":"  + String(current.white)  + ",";
  json += "\"power\":"  + String(globalPower ? "true" : "false") + ",";
  json += "\"manual\":" + String(manualOverride ? "true" : "false") + ",";
  json += "\"fanSpeed\":" + String(fanSpeed) + ",";";
  json += "\"time\":\"" + String(timeBuf) + "\",";
  json += "\"uptime\":"  + String(millis() / 1000) + ",";
  json += "\"wifi\":"   + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
  json += "\"ip\":\""   + WiFi.localIP().toString() + "\",";
  json += "\"logs\":[";
  bool firstLog = true;
  for(int i=0; i<MAX_LOGS; i++) {
    int idx = (logIndex + i) % MAX_LOGS;
    if (sysLogs[idx].length() > 0) {
      if (!firstLog) json += ",";
      // Trim each log entry to 30 chars to keep payload tight
      String entry = sysLogs[idx];
      if (entry.length() > 30) entry = entry.substring(0, 30);
      json += "\"" + entry + "\"";
      firstLog = false;
    }
  }
  json += "],";
  json += "\"schedule\":{";
  json += "\"enabled\":"     + String(schedule.enabled ? "true" : "false") + ",";
  json += "\"sunriseHour\":" + String(schedule.sunriseHour) + ",";
  json += "\"sunriseMin\":"  + String(schedule.sunriseMin)  + ",";
  json += "\"sunsetHour\":"  + String(schedule.sunsetHour)  + ",";
  json += "\"sunsetMin\":"   + String(schedule.sunsetMin)   + ",";
  json += "\"rampMinutes\":" + String(schedule.rampMinutes) + ",";
  json += "\"peakBlue\":"    + String(schedule.peakBlue)    + ",";
  json += "\"peakWhite\":"   + String(schedule.peakWhite)   + ",";
  json += "\"peakUvRed\":"   + String(schedule.peakUvRed);
  json += "}}";
  return json;
}

// ─── HTTP HANDLERS ──────────────────────────────────────────────────

void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", buildStateJson());
}

void handleSetChannel() {
  if (!server.hasArg("plain")) return;
  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"ok\":false}"); return;
  }
  manualOverride = true;
  if (doc["uvRed"].is<int>()) current.uvRed = (uint8_t)doc["uvRed"].as<int>();
  if (doc["blueA"].is<int>()) current.blueA = (uint8_t)doc["blueA"].as<int>();
  if (doc["blueB"].is<int>()) current.blueB = (uint8_t)doc["blueB"].as<int>();
  if (doc["white"].is<int>()) current.white = (uint8_t)doc["white"].as<int>();
  applyChannels();
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleSetSchedule() {
  if (!server.hasArg("plain")) return;
  JsonDocument doc;
  if (deserializeJson(doc, server.arg("plain"))) {
    server.send(400, "application/json", "{\"ok\":false}"); return;
  }
  if (doc["enabled"].is<bool>())     schedule.enabled     = doc["enabled"].as<bool>();
  if (doc["sunriseHour"].is<int>())  schedule.sunriseHour = doc["sunriseHour"].as<int>();
  if (doc["sunriseMin"].is<int>())   schedule.sunriseMin  = doc["sunriseMin"].as<int>();
  if (doc["sunsetHour"].is<int>())   schedule.sunsetHour  = doc["sunsetHour"].as<int>();
  if (doc["sunsetMin"].is<int>())    schedule.sunsetMin   = doc["sunsetMin"].as<int>();
  if (doc["rampMinutes"].is<int>())  schedule.rampMinutes = doc["rampMinutes"].as<int>();
  if (doc["peakBlue"].is<int>())     schedule.peakBlue    = doc["peakBlue"].as<int>();
  if (doc["peakWhite"].is<int>())    schedule.peakWhite   = doc["peakWhite"].as<int>();
  if (doc["peakUvRed"].is<int>())    schedule.peakUvRed   = doc["peakUvRed"].as<int>();
  savePrefs();
  manualOverride = false;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleAutoMode() {
  manualOverride = false;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(204);
}

// ─── MQTT ───────────────────────────────────────────────────────────

void publishState() {
  if (!mqttClient.connected()) return;
  String json = buildStateJson();
  if (json.length() >= MQTT_BUFFER_SIZE) {
    Serial.println("WARN: State JSON too large: " + String(json.length()) + " bytes");
  }
  mqttClient.publish(mqtt_topic_state, json.c_str());
  lastMqttPublish = millis();
  stateChanged = false;
}

void handleMqttMessage(char* topic, byte* payload, unsigned int length) {
  char msg[length + 1];
  memcpy(msg, payload, length);
  msg[length] = '\0';

  JsonDocument doc;
  if (deserializeJson(doc, msg)) {
    Serial.println("MQTT JSON parse error");
    return;
  }
  if (!doc["cmd_type"].is<String>()) return;

  String type = doc["cmd_type"].as<String>();

  // ── channels: Set all 4 channel intensities (0-255), enables manual mode
  if (type == "channels") {
    manualOverride = true;
    if (doc["uvRed"].is<int>()) current.uvRed = (uint8_t)doc["uvRed"].as<int>();
    if (doc["blueA"].is<int>()) current.blueA = (uint8_t)doc["blueA"].as<int>();
    if (doc["blueB"].is<int>()) current.blueB = (uint8_t)doc["blueB"].as<int>();
    if (doc["white"].is<int>()) current.white = (uint8_t)doc["white"].as<int>();
    applyChannels();
    publishState();

  // ── schedule: Update schedule fields, save to flash, apply immediately
  } else if (type == "schedule") {
    if (doc["enabled"].is<bool>())     schedule.enabled     = doc["enabled"].as<bool>();
    if (doc["sunriseHour"].is<int>())  schedule.sunriseHour = doc["sunriseHour"].as<int>();
    if (doc["sunriseMin"].is<int>())   schedule.sunriseMin  = doc["sunriseMin"].as<int>();
    if (doc["sunsetHour"].is<int>())   schedule.sunsetHour  = doc["sunsetHour"].as<int>();
    if (doc["sunsetMin"].is<int>())    schedule.sunsetMin   = doc["sunsetMin"].as<int>();
    if (doc["rampMinutes"].is<int>())  schedule.rampMinutes = doc["rampMinutes"].as<int>();
    if (doc["peakBlue"].is<int>())     schedule.peakBlue    = doc["peakBlue"].as<int>();
    if (doc["peakWhite"].is<int>())    schedule.peakWhite   = doc["peakWhite"].as<int>();
    if (doc["peakUvRed"].is<int>())    schedule.peakUvRed   = doc["peakUvRed"].as<int>();
    savePrefs();
    // Immediately disable manual override and run the new schedule
    // so the lamp adjusts to the new settings right away
    manualOverride = false;
    runSchedule();
    addLog("Schedule updated");
    publishState();

  // ── auto: Disable manual override, resume the auto schedule immediately
  } else if (type == "auto") {
    manualOverride = false;
    runSchedule();
    publishState();

  // ── power: Master power toggle (on: true/false)
  } else if (type == "power") {
    if (doc["on"].is<bool>()) {
      globalPower = doc["on"].as<bool>();
      savePrefs();
      applyChannels();
      addLog(globalPower ? "Power ON" : "Power OFF");
      publishState();
    }

  // ── fan: Set fan speed 0-100%, saved to NVS
  } else if (type == "fan") {
    if (doc["speed"].is<int>()) {
      int spd = constrain(doc["speed"].as<int>(), 0, 100);
      fanSpeed = (uint8_t)spd;
      applyFan();
      savePrefs();
      addLog("Fan " + String(fanSpeed) + "%");
      publishState();
    }

  // ── get_state: Immediately publish full current state to UI
  } else if (type == "get_state") {
    publishState();

  // ── manual: Flag manual override mode without changing channels yet
  } else if (type == "manual") {
    manualOverride = true;
    publishState();
  }
}

void reconnectMqtt() {
  if (mqttClient.connected()) return;
  Serial.print("MQTT connecting...");
  String clientId = "ReefESP32-" + String(random(0xffff), HEX);
  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("connected");
    addLog("MQTT connected");
    mqttClient.subscribe(mqtt_topic_cmd);
    publishState();
  } else {
    Serial.print("failed rc=");
    Serial.println(mqttClient.state());
    addLog("MQTT fail " + String(mqttClient.state()));
  }
}

// ─── SETUP ──────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(500);

  ledcAttach(PIN_UV_RED, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_BLUE_A, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_BLUE_B, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_WHITE,  PWM_FREQ, PWM_RES);
  ledcAttach(PIN_FAN,    FAN_PWM_FREQ, PWM_RES);
  allOff();
  loadPrefs();
  applyFan();  // apply saved fan speed on boot
  connectWifi();

  // Set MQTT buffer to 1024 bytes to safely handle large state JSON payloads
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(handleMqttMessage);
  mqttClient.setBufferSize(MQTT_BUFFER_SIZE);

  server.on("/status",   HTTP_GET,     handleStatus);
  server.on("/set",      HTTP_POST,    handleSetChannel);
  server.on("/schedule", HTTP_POST,    handleSetSchedule);
  server.on("/auto",     HTTP_POST,    handleAutoMode);
  server.on("/set",      HTTP_OPTIONS, handleOptions);
  server.on("/schedule", HTTP_OPTIONS, handleOptions);
  server.on("/auto",     HTTP_OPTIONS, handleOptions);
  server.begin();

  Serial.println("Creators Aquarium Controller v1.2 ready");
  Serial.println("http://" + WiFi.localIP().toString());
}

// ─── LOOP ───────────────────────────────────────────────────────────

void loop() {
  server.handleClient();

  // Schedule tick every 30s
  static uint32_t lastSchedule = 0;
  if (millis() - lastSchedule > 30000) {
    runSchedule();
    lastSchedule = millis();
  }

  // WiFi watchdog every 30s
  if (millis() - lastWifiCheck > 30000) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi lost - reconnecting...");
      addLog("WiFi lost");
      WiFi.reconnect();
    } else if (!timesynced) {
      struct tm t;
      if (getLocalTime(&t, 2000)) {
        timesynced = true;
        addLog("Time synced");
      }
    }
    lastWifiCheck = millis();
  }

  // MQTT reconnect + loop
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      static uint32_t lastMqttAttempt = 0;
      if (millis() - lastMqttAttempt > 5000) {
        lastMqttAttempt = millis();
        reconnectMqtt();
      }
    } else {
      mqttClient.loop();
    }
  }

  // Publish state if changed, or every 60s heartbeat
  if (stateChanged || millis() - lastMqttPublish > 60000) {
    publishState();
  }

  delay(10);
}

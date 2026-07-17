// =========================================================
//  wifiConfig.h  –  WiFi Manager + Captive Portal cho ESP32
//
//  Tính năng:
//    • Lưu credentials vào Flash (NVS – tồn tại sau reboot)
//    • Thứ tự kết nối: NVS → hardcode → Captive Portal
//    • Captive Portal: dark glassmorphism, quét WiFi, nhập pass
//    • LED phản hồi trạng thái (GPIO 2 mặc định)
//    • Giữ nút BOOT (GPIO 0) 5 giây để xóa credentials & reset
//
//  Cách dùng:
//    #include "wifiConfig.h"
//    setup() { Serial.begin(115200); wifiConfig.begin("ssid","pass"); }
//    loop()  { wifiConfig.run(); }
// =========================================================

#pragma once

#include <DNSServer.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>

// ---- Pin & timeout (override trước #include nếu cần) ----
#ifndef WCFG_LED_PIN
#define WCFG_LED_PIN 2
#endif
#ifndef WCFG_BTN_PIN
#define WCFG_BTN_PIN 0
#endif
#ifndef WCFG_AP_PREFIX
#define WCFG_AP_PREFIX "AQI-"
#endif
#define WCFG_RESET_MS 5000    // Giữ bao lâu để reset
#define WCFG_CONNECT_MS 15000 // Timeout kết nối

// ---- Chế độ WiFi ----
#define WIFI_MODE_AP 0        // Đang ở chế độ portal cấu hình
#define WIFI_MODE_CONNECTED 1 // Đã kết nối thành công
#define WIFI_MODE_LOST 2      // Mất kết nối (taskNetwork tự xử lý)

// =========================================================
//  HTML PORTAL
// =========================================================
static const char _WCFG_HTML[] PROGMEM = R"html(
  <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>CÀI ĐẶT THÔNG TIN WIFI</title>
        <style type="text/css">
          body{display: flex;justify-content: center;align-items: center;}
          button{width: 135px;height: 40px;margin-top: 10px;border-radius: 5px}
          label, span{font-size: 25px;}
          input{margin-bottom: 10px;width:275px;height: 30px;font-size: 17px;}
          select{margin-bottom: 10px;width: 280px;height: 30px;font-size: 17px;}
        </style>
    </head>
    <body>
      <div>
        <h3 style="text-align: center;">CÀI ĐẶT THÔNG TIN WIFI</h3>
        <p id="info" style="text-align: center;">Đang quét mạng WiFi...!</p>
        <label>Tên WiFi:</label><br>
        <select id="ssid">
          <option>Chọn mạng WiFi!</option>
        </select><br>
        <label>Mật khẩu:</label><br>
        <input id="password" type="text"><br>

        <button onclick="saveWifi()" style="background-color: cyan;margin-right: 10px">LƯU</button>
        <button onclick="reStart()" style="background-color: pink;">KHỞI ĐỘNG LẠI</button>
      </div>
        <script type="text/javascript">
          window.onload=function(){
            scanWifi();
          }
          var xhttp = new XMLHttpRequest();
          function scanWifi(){
            xhttp.onreadystatechange = function(){
              if(xhttp.readyState==4&&xhttp.status==200){
                data = xhttp.responseText;
                document.getElementById("info").innerHTML = "Đã quét xong WiFi!"
                var obj = JSON.parse(data);
                var select = document.getElementById("ssid");
                for(var i=0; i<obj.length;++i){
                  select[select.length] = new Option(obj[i],obj[i]);
                }
              }
            }
            xhttp.open("GET","/scanWifi",true);
            xhttp.send();
          }
          function saveWifi(){
            var ssid = document.getElementById("ssid").value;
            var pass = document.getElementById("password").value;
            document.getElementById("info").innerHTML = "Đang thử kết nối... Vui lòng chờ (tối đa 15s)!";
            xhttp.onreadystatechange = function(){
              if(xhttp.readyState==4&&xhttp.status==200){
                data = xhttp.responseText;
                document.getElementById("info").innerHTML = data;
                alert(data);
              }
            }
            xhttp.open("GET","/saveWifi?ssid="+encodeURIComponent(ssid)+"&pass="+encodeURIComponent(pass),true);
            xhttp.send();
          }
          function reStart(){
            xhttp.onreadystatechange = function(){
              if(xhttp.readyState==4&&xhttp.status==200){
                data = xhttp.responseText;
                alert(data);
              }
            }
            xhttp.open("GET","/reStart",true);
            xhttp.send();
          }
        </script>
    </body>
  </html>
)html";

// =========================================================
//  CLASS WifiConfigClass
// =========================================================
class WifiConfigClass {
private:
  String _ssid, _pass;
  WebServer _srv;
  DNSServer _dns;
  Preferences _prefs;
  int _mode;

  unsigned long _lastPress;
  unsigned long _blinkTime;

  // ---- Portal state machine ----
  enum PState { P_IDLE, P_CONNECTING, P_CONNECTED, P_FAILED };
  PState _pState;
  String _pSSID, _pPass;
  unsigned long _pStart;

  // =========================================================
  //  NVS helpers
  // =========================================================
  void _load() {
    _prefs.begin("wcfg", true); // read-only
    _ssid = _prefs.getString("s", "");
    _pass = _prefs.getString("p", "");
    _prefs.end();
    if (_ssid.length() > 0)
      Serial.printf("[WifiCfg] NVS: %s\n", _ssid.c_str());
  }

  void _save(const String &s, const String &p) {
    _prefs.begin("wcfg", false);
    _prefs.putString("s", s);
    _prefs.putString("p", p);
    _prefs.end();
    Serial.printf("[WifiCfg] Saved: %s\n", s.c_str());
  }

  void _clear() {
    _prefs.begin("wcfg", false);
    _prefs.clear();
    _prefs.end();
  }

  // =========================================================
  //  LED blink
  // =========================================================
  void _blink(uint32_t ms) {
    if (millis() - _blinkTime > ms) {
      digitalWrite(WCFG_LED_PIN, !digitalRead(WCFG_LED_PIN));
      _blinkTime = millis();
    }
  }

  void _ledTick() {
    if (digitalRead(WCFG_BTN_PIN) == LOW) {
      // Đang giữ nút: nhấp nháy theo thời gian giữ
      _blink(millis() - _lastPress < WCFG_RESET_MS ? 200 : 50);
    } else {
      if (_mode == WIFI_MODE_AP)
        _blink(100); // Nhanh: đang ở portal
      else if (_mode == WIFI_MODE_CONNECTED)
        _blink(3000); // Chậm: đã kết nối
      else
        _blink(300); // Vừa: mất WiFi
    }
  }

  // =========================================================
  //  Nút BOOT – giữ 5 giây để xóa credentials
  // =========================================================
  void _checkBtn() {
    if (digitalRead(WCFG_BTN_PIN) == LOW) {
      if (millis() - _lastPress > WCFG_RESET_MS) {
        Serial.println("[WifiCfg] Reset credentials & restart!");
        _clear();
        delay(300);
        ESP.restart();
      }
    } else {
      _lastPress = millis();
    }
  }

  // =========================================================
  //  JSON string escape
  // =========================================================
  String _jesc(const String &s) {
    String o;
    for (char c : s) {
      if (c == '"')
        o += "\\\"";
      else if (c == '\\')
        o += "\\\\";
      else
        o += c;
    }
    return o;
  }

  // =========================================================
  //  Portal HTTP handlers
  // =========================================================
  void _hRoot() {
    _srv.sendHeader("Cache-Control", "no-cache");
    _srv.send(200, "text/html", _WCFG_HTML);
  }

  void _hScan() {
    Serial.println("[WifiCfg] Scanning wifi network...");
    // Clear previous scan results to free memory
    WiFi.scanDelete();

    // Đảm bảo STA idle trước khi quét
    WiFi.disconnect();
    delay(100);

    int wifi_nets = WiFi.scanNetworks(true, true);
    const unsigned long t = millis();
    while (wifi_nets < 0 && millis() - t < 10000) {
      delay(20);
      wifi_nets = WiFi.scanComplete();
    }
    Serial.printf("[WifiCfg] Scan finished. Found %d networks.\n", wifi_nets);

    String json = "[";
    if (wifi_nets > 0) {
      bool first = true;
      for (int i = 0; i < wifi_nets; i++) {
        String s = WiFi.SSID(i);
        if (s.isEmpty())
          continue;
        if (!first)
          json += ",";
        json += "\"" + _jesc(s) + "\"";
        first = false;
      }
    }
    json += "]";
    WiFi.scanDelete();
    _srv.send(200, "application/json", json);
  }

  void _hSave() {
    _pSSID = _srv.arg("ssid");
    _pPass = _srv.arg("pass");
    Serial.println("[WifiCfg] SSID: " + _pSSID);
    Serial.println("[WifiCfg] PASS: " + _pPass);
    _save(_pSSID, _pPass);

    // Thử kết nối ngay lập tức (vẫn giữ AP để điện thoại không bị văng)
    WiFi.mode(WIFI_AP_STA);
    WiFi.disconnect(); // Ngắt kết nối STA cũ nếu có
    delay(100);
    WiFi.begin(_pSSID.c_str(), _pPass.c_str());

    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < WCFG_CONNECT_MS) {
      delay(200);
      Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("\n[WifiCfg] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
      _srv.send(200, "text/plain", "Đã lưu và Kết nối THÀNH CÔNG! Hãy bấm Khởi động lại.");
    } else {
      Serial.println("\n[WifiCfg] Connection Failed.");
      _srv.send(200, "text/plain", "Đã lưu nhưng KẾT NỐI THẤT BẠI! Hãy kiểm tra lại mật khẩu.");
    }
  }

  void _hRestart() {
    _srv.send(200, "text/plain", "Esp32 is restarting!");
    delay(2000);
    ESP.restart();
  }

  // =========================================================
  //  Khởi động AP + WebServer + DNS
  // =========================================================
  void _startPortal() {
    WiFi.mode(WIFI_AP_STA); // AP_STA để vừa host AP vừa scan/connect STA

    // Tên AP dựa trên MAC (unique mỗi thiết bị)
    uint8_t mac[6];
    WiFi.softAPmacAddress(mac);
    String apName =
        String(WCFG_AP_PREFIX) + String(mac[4], HEX) + String(mac[5], HEX);
    apName.toUpperCase();
    WiFi.softAP(apName.c_str()); // Không có mật khẩu → điện thoại tự mở portal
    delay(200);

    // DNS server: bắt tất cả domain → 192.168.4.1
    _dns.start(53, "*", WiFi.softAPIP());

    // HTTP routes
    _srv.on("/", [this] { _hRoot(); });
    _srv.on("/generate_204", [this] { _hRoot(); }); // Android captive check
    _srv.on("/fwlink", [this] { _hRoot(); });       // Windows captive check
    _srv.on("/scanWifi", HTTP_GET, [this] { _hScan(); });
    _srv.on("/saveWifi", HTTP_GET, [this] { _hSave(); });
    _srv.on("/reStart", HTTP_GET, [this] { _hRestart(); });
    _srv.onNotFound([this] { _hRoot(); });
    _srv.begin();

    _mode = WIFI_MODE_AP;
    _pState = P_IDLE;

    Serial.println("=============================================");
    Serial.printf("[Portal]  AP   : %s\n", apName.c_str());
    Serial.printf("[Portal]  IP   : %s\n", WiFi.softAPIP().toString().c_str());
    Serial.println("[Portal]  Ket noi dien thoai, mo trinh duyet");
    Serial.println("=============================================");
  }

  // =========================================================
  //  Thử kết nối WiFi STA (blocking, timeout WCFG_CONNECT_MS)
  // =========================================================
  bool _tryConnect(const String &s, const String &p, const char *label) {
    if (s.isEmpty())
      return false;
    Serial.printf("[WifiCfg] Trying %s: %s\n", label, s.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.begin(s.c_str(), p.c_str());
    unsigned long t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < WCFG_CONNECT_MS) {
      _ledTick();
      delay(200);
      Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("\n[WifiCfg] Connected! IP: %s\n",
                    WiFi.localIP().toString().c_str());
      return true;
    }
    Serial.printf("\n[WifiCfg] %s failed.\n", label);
    return false;
  }

public:
  // Constructor
  WifiConfigClass()
      : _srv(80), _mode(WIFI_MODE_AP), _lastPress(0), _blinkTime(0),
        _pState(P_IDLE) {}

  // =========================================================
  //  begin() – Gọi trong setup(), BLOCK cho đến khi có WiFi
  //
  //  hardSSID / hardPass: credentials hardcode làm fallback
  //  (bỏ trống nếu chỉ muốn dùng NVS + portal)
  // =========================================================
  void begin(const char *hardSSID = "", const char *hardPass = "") {
    pinMode(WCFG_LED_PIN, OUTPUT);
    pinMode(WCFG_BTN_PIN, INPUT_PULLUP);
    _lastPress = millis();

    // 1. Thử NVS credentials
    _load();
    if (_tryConnect(_ssid, _pass, "NVS")) {
      _mode = WIFI_MODE_CONNECTED;
      return;
    }

    // 2. Thử hardcode credentials
    if (strlen(hardSSID) > 0) {
      if (_tryConnect(String(hardSSID), String(hardPass), "hardcode")) {
        _ssid = hardSSID;
        _pass = hardPass;
        _mode = WIFI_MODE_CONNECTED;
        return;
      }
    }

    // 3. Bật Captive Portal
    WiFi.disconnect(true);
    delay(200);
    _startPortal();

    // Vòng lặp phục vụ portal cho đến khi user kết nối thành công
    while (_pState != P_CONNECTED) {
      _dns.processNextRequest();
      _srv.handleClient();
      _ledTick();
      _checkBtn();

      if (_pState == P_CONNECTING) {
        if (millis() - _pStart > WCFG_CONNECT_MS) {
          Serial.println("[Portal] Timeout.");
          WiFi.disconnect(true);
          delay(100);
          _pState = P_FAILED;
        } else if (WiFi.status() == WL_CONNECTED &&
                   WiFi.localIP() != IPAddress(0, 0, 0, 0)) {
          Serial.printf("[Portal] Connected! IP: %s\n",
                        WiFi.localIP().toString().c_str());
          _pState = P_CONNECTED;
        }
      }
      delay(10);
    }

    // Tiếp tục serve thêm 3 giây để browser kịp nhận response "connected"
    // trước khi AP bị tắt (tránh browser thấy network error)
    {
      unsigned long grace = millis();
      while (millis() - grace < 3000) {
        _dns.processNextRequest();
        _srv.handleClient();
        _ledTick();
        delay(10);
      }
    }

    // Lưu credentials & dọn dẹp
    _save(_pSSID, _pPass);
    _ssid = _pSSID;
    _pass = _pPass;

    _dns.stop();
    _srv.close();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    delay(300);

    _mode = WIFI_MODE_CONNECTED;
    Serial.printf("[WifiCfg] Ready! IP: %s\n",
                  WiFi.localIP().toString().c_str());
  }

  // =========================================================
  //  run() – Gọi trong loop() hoặc FreeRTOS task
  //  Xử lý LED feedback + nút reset
  // =========================================================
  void run() {
    _ledTick();
    _checkBtn();
  }

  // ---- Getters ----
  String getSSID() const { return _ssid; }
  String getPass() const { return _pass; }
  int getMode() const { return _mode; }

  // Gọi từ WiFiEvent / taskNetwork khi mất/có kết nối
  void setMode(int m) { _mode = m; }
};

// ---- Global instance ----
WifiConfigClass wifiConfig;

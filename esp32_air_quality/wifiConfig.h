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

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>

// ---- Pin & timeout (override trước #include nếu cần) ----
#ifndef WCFG_LED_PIN
  #define WCFG_LED_PIN     2
#endif
#ifndef WCFG_BTN_PIN
  #define WCFG_BTN_PIN     0
#endif
#ifndef WCFG_AP_PREFIX
  #define WCFG_AP_PREFIX   "AQI-"
#endif
#define WCFG_RESET_MS      5000   // Giữ bao lâu để reset
#define WCFG_CONNECT_MS    15000  // Timeout kết nối

// ---- Chế độ WiFi ----
#define WIFI_MODE_AP         0   // Đang ở chế độ portal cấu hình
#define WIFI_MODE_CONNECTED  1   // Đã kết nối thành công
#define WIFI_MODE_LOST       2   // Mất kết nối (taskNetwork tự xử lý)

// =========================================================
//  HTML PORTAL – dark glassmorphism (lưu trên Flash)
// =========================================================
// HTML chia 2 phần để giảm peak memory của compiler (tránh cc1plus OOM)
static const char _WCFG_HTML_A[] PROGMEM =
"<!DOCTYPE html>"
"<html lang=\"vi\"><head>"
"<meta charset=\"UTF-8\">"
"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\">"
"<title>AQI Station &#8211; WiFi Setup</title>"
"<style>"
"*{margin:0;padding:0;box-sizing:border-box}"
"body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
"background:linear-gradient(135deg,#0a0e1a 0%,#131929 60%,#0d1b2a 100%);"
"min-height:100vh;color:#e2e8f0;"
"display:flex;align-items:center;justify-content:center;padding:20px}"
".card{background:rgba(255,255,255,0.05);"
"backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);"
"border:1px solid rgba(255,255,255,0.1);"
"border-radius:24px;padding:28px;width:100%;max-width:400px;"
"box-shadow:0 25px 50px rgba(0,0,0,0.6)}"
".logo{width:56px;height:56px;"
"background:linear-gradient(135deg,#00d2ff,#3a7bd5);"
"border-radius:16px;display:flex;align-items:center;justify-content:center;"
"margin:0 auto 14px;box-shadow:0 8px 24px rgba(0,210,255,0.4)}"
".logo svg{width:30px;height:30px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}"
"h1{text-align:center;font-size:20px;font-weight:700;"
"background:linear-gradient(135deg,#00d2ff,#a78bfa);"
"-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;"
"margin-bottom:4px}"
".sub{text-align:center;color:#64748b;font-size:13px;margin-bottom:22px}"
".sec{font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}"
".wlist{max-height:220px;overflow-y:auto;margin-bottom:10px;"
"scrollbar-width:thin;scrollbar-color:#334155 transparent}"
".wlist::-webkit-scrollbar{width:3px}"
".wlist::-webkit-scrollbar-thumb{background:#334155;border-radius:99px}"
".witem{display:flex;align-items:center;gap:11px;padding:11px 13px;"
"background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);"
"border-radius:12px;cursor:pointer;margin-bottom:7px;transition:all .18s ease}"
".witem:hover{background:rgba(0,210,255,0.08);border-color:rgba(0,210,255,0.25)}"
".witem.active{background:rgba(0,210,255,0.12);border-color:rgba(0,210,255,0.5)}"
".bars{display:flex;align-items:flex-end;gap:2px;height:16px;width:18px;flex-shrink:0}"
".bar{background:#334155;border-radius:2px;width:4px;transition:background .18s}"
".b1{height:4px}.b2{height:8px}.b3{height:12px}.b4{height:16px}"
".witem:hover .bar,.witem.active .bar{background:#64748b}"
".bar.on{background:#00d2ff!important}"
".wname{flex:1;font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
".wlock{color:#64748b;font-size:12px;flex-shrink:0}"
".form{background:rgba(0,210,255,0.06);border:1px solid rgba(0,210,255,0.2);"
"border-radius:14px;padding:16px;margin-top:4px;margin-bottom:14px;"
"display:none;animation:fi .2s ease}"
".form.show{display:block}"
"@keyframes fi{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}"
".fssid{font-size:14px;font-weight:600;color:#00d2ff;margin-bottom:12px}"
".iw{position:relative}"
".pi{width:100%;background:rgba(255,255,255,0.07);"
"border:1px solid rgba(255,255,255,0.12);border-radius:10px;"
"color:#e2e8f0;font-size:14px;padding:11px 42px 11px 14px;"
"outline:none;transition:border-color .18s;-webkit-appearance:none}"
".pi:focus{border-color:#00d2ff;background:rgba(0,210,255,0.06)}"
".eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);"
"background:none;border:none;color:#64748b;cursor:pointer;"
"font-size:16px;padding:4px;line-height:1;transition:color .18s}"
".eye:hover{color:#94a3b8}"
".btn{width:100%;margin-top:12px;padding:12px;border:none;border-radius:11px;"
"background:linear-gradient(135deg,#00d2ff,#3a7bd5);"
"color:#fff;font-size:14px;font-weight:600;cursor:pointer;"
"box-shadow:0 4px 16px rgba(0,210,255,0.3);transition:all .18s;letter-spacing:.3px}"
".btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,210,255,0.4)}"
".btn:active{transform:translateY(0)}"
".btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}"
".sbtn{width:100%;padding:9px;background:rgba(255,255,255,0.04);"
"border:1px solid rgba(255,255,255,0.09);border-radius:10px;"
"color:#64748b;font-size:12px;cursor:pointer;transition:all .18s;"
"margin-bottom:16px;letter-spacing:.3px}"
".sbtn:hover{background:rgba(255,255,255,0.08);color:#94a3b8}"
".st{border-radius:12px;padding:12px 16px;font-size:13px;margin-top:2px;display:none;text-align:center}"
".st.show{display:block}"
".sc{background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.25);color:#fbbf24}"
".ss{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#22c55e}"
".se{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#f87171}"
".sp{display:inline-block;width:13px;height:13px;"
"border:2px solid rgba(251,191,36,0.3);border-top-color:#fbbf24;"
"border-radius:50%;animation:sn .7s linear infinite;margin-right:6px;vertical-align:middle}"
"@keyframes sn{to{transform:rotate(360deg)}}"
".em{text-align:center;color:#475569;font-size:13px;padding:22px 0}"
".hint{text-align:center;color:#334155;font-size:11px;margin-top:8px}"
"</style></head>";

static const char _WCFG_HTML_B[] PROGMEM =
"<body><div class=\"card\">"
"<div class=\"logo\"><svg viewBox=\"0 0 24 24\">"
"<circle cx=\"12\" cy=\"12\" r=\"3\"/>"
"<path d=\"M6.3 6.3a8 8 0 0 0 0 11.4M17.7 17.7a8 8 0 0 0 0-11.4\"/>"
"<path d=\"M3.5 3.5a13 13 0 0 0 0 17M20.5 20.5a13 13 0 0 0 0-17\"/>"
"</svg></div>"
"<h1>AQI Station</h1>"
"<p class=\"sub\">C&#7845;u h&#236;nh WiFi &#273;&#7875; b&#7855;t &#273;&#7847;u gi&#225;m s&#225;t kh&#244;ng kh&#237;</p>"
"<p class=\"sec\">M&#7841;ng WiFi g&#7847;n &#273;&#226;y</p>"
"<div class=\"wlist\" id=\"L\"><div class=\"em\">&#9203; &#272;ang qu&#233;t m&#7841;ng...</div></div>"
"<button class=\"sbtn\" onclick=\"scan()\">&#8635; Qu&#233;t l&#7841;i</button>"
"<div class=\"form\" id=\"F\">"
"<div class=\"fssid\" id=\"FS\"></div>"
"<div class=\"iw\">"
"<input class=\"pi\" type=\"password\" id=\"P\" placeholder=\"Nh&#7853;p m&#7853;t kh&#7849;u WiFi...\">"
"<button class=\"eye\" onclick=\"tw()\" type=\"button\">&#128065;</button>"
"</div>"
"<button class=\"btn\" id=\"CB\" onclick=\"conn()\">K&#7871;t n&#7889;i</button>"
"</div>"
"<div class=\"st\" id=\"ST\"></div>"
"<p class=\"hint\">&#128274; Gi&#7919; n&#250;t BOOT 5 gi&#226;y &#273;&#7875; x&#243;a c&#224;i &#273;&#7863;t</p>"
"</div>"
"<script>"
"var sel='',tm=null;"
"function bars(r){"
"var l=r>-55?4:r>-70?3:r>-80?2:1;"
"var h='<div class=\"bars\">';"
"for(var i=1;i<=4;i++)h+='<div class=\"bar b'+i+(i<=l?' on':'')+'\"></div>';"
"return h+'</div>';}"
"function xe(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');}"
"function scan(){"
"document.getElementById('L').innerHTML='<div class=\"em\">&#9203; &#272;ang qu&#233;t m&#7841;ng...</div>';"
"document.getElementById('F').classList.remove('show');"
"fetch('/scan').then(r=>r.json()).then(d=>{"
"if(!d.length){document.getElementById('L').innerHTML='<div class=\"em\">Kh&#244;ng t&#236;m th&#7845;y m&#7841;ng n&#224;o</div>';return;}"
"document.getElementById('L').innerHTML=d.map(n=>"
"'<div class=\"witem\" onclick=\"pick(this,\''+xe(n.ssid)+'\')\">'"
"+bars(n.rssi)"
"+'<span class=\"wname\">'+xe(n.ssid)+'</span>'"
"+(n.open?'':'<span class=\"wlock\">&#128274;</span>')"
"+'</div>'"
").join('');"
"}).catch(()=>{document.getElementById('L').innerHTML='<div class=\"em\">L&#7895;i qu&#233;t. Th&#7917; l&#7841;i!</div>';});}"
"function pick(el,ssid){"
"document.querySelectorAll('.witem').forEach(e=>e.classList.remove('active'));"
"el.classList.add('active');sel=ssid;"
"document.getElementById('FS').innerHTML='&#128246; <b>'+xe(ssid)+'</b>';"
"document.getElementById('F').classList.add('show');"
"document.getElementById('P').focus();}"
"function tw(){var p=document.getElementById('P');p.type=p.type==='password'?'text':'password';}"
"function setstatus(cls,html){var s=document.getElementById('ST');s.className='st show '+cls;s.innerHTML=html;}"
"function conn(){"
"if(!sel)return;"
"var pw=document.getElementById('P').value;"
"document.getElementById('CB').disabled=true;"
"setstatus('sc','<span class=\"sp\"></span>&#272;ang k&#7871;t n&#7889;i t&#7899;i <b>'+xe(sel)+'</b>...');"
"fetch('/connect',{method:'POST',body:new URLSearchParams({ssid:sel,pass:pw})})"
".then(r=>r.json()).then(()=>{"
"var tries=0,errs=0;if(tm)clearInterval(tm);"
"tm=setInterval(()=>{"
"fetch('/status').then(r=>r.json()).then(d=>{"
"if(d.status==='connected'){"
"clearInterval(tm);"
"setstatus('ss','&#9989; K&#7871;t n&#7889;i th&#224;nh c&#244;ng!<br>IP: <b>'+d.ip+'</b><br>H&#7879; th&#7889;ng &#273;ang kh&#7903;i &#273;&#7897;ng...');"
"}else if(d.status==='failed'||++tries>20){"
"clearInterval(tm);"
"setstatus('se','&#10060; Sai m&#7853;t kh&#7849;u ho&#7863;c m&#7841;ng kh&#244;ng kh&#7843; d&#7909;ng. Th&#7917; l&#7841;i.');"
"document.getElementById('CB').disabled=false;}"
"}).catch(()=>{"
"if(++errs>=2){"
"clearInterval(tm);"
"setstatus('ss','&#9989; K&#7871;t n&#7889;i th&#224;nh c&#244;ng!<br>H&#7879; th&#7889;ng &#273;ang kh&#7903;i &#273;&#7897;ng...');}}}"
",1000);}).catch(()=>{setstatus('se','&#10060; L&#7895;i k&#7871;t n&#7889;i. Th&#7917; l&#7841;i.');document.getElementById('CB').disabled=false;});}"
"document.getElementById('P').addEventListener('keydown',e=>{if(e.key==='Enter')conn();});"
"scan();"
"</script></body></html>";



// =========================================================
//  CLASS WifiConfigClass
// =========================================================
class WifiConfigClass {
private:
  String      _ssid, _pass;
  WebServer   _srv;
  DNSServer   _dns;
  Preferences _prefs;
  int         _mode;

  unsigned long _lastPress;
  unsigned long _blinkTime;

  // ---- Portal state machine ----
  enum PState { P_IDLE, P_CONNECTING, P_CONNECTED, P_FAILED };
  PState  _pState;
  String  _pSSID, _pPass;
  unsigned long _pStart;

  // =========================================================
  //  NVS helpers
  // =========================================================
  void _load() {
    _prefs.begin("wcfg", true);          // read-only
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
      if      (_mode == WIFI_MODE_AP)        _blink(100);   // Nhanh: đang ở portal
      else if (_mode == WIFI_MODE_CONNECTED) _blink(3000);  // Chậm: đã kết nối
      else                                   _blink(300);   // Vừa: mất WiFi
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
      if      (c == '"')  o += "\\\"";
      else if (c == '\\') o += "\\\\";
      else                o += c;
    }
    return o;
  }

  // =========================================================
  //  Portal HTTP handlers
  // =========================================================
  void _hRoot() {
    // Gửi HTML 2 phần (do tách PROGMEM để giảm tải compiler)
    size_t lenA = strlen_P(_WCFG_HTML_A);
    size_t lenB = strlen_P(_WCFG_HTML_B);
    _srv.sendHeader("Cache-Control", "no-cache");
    _srv.setContentLength(lenA + lenB);
    _srv.send(200, "text/html", "");
    _srv.sendContent_P(_WCFG_HTML_A);
    _srv.sendContent_P(_WCFG_HTML_B);
  }

  void _hScan() {
    // Async scan để không block quá lâu
    int n = WiFi.scanNetworks(true, false);
    unsigned long t = millis();
    while (n < 0 && millis() - t < 10000) {
      delay(20);
      n = WiFi.scanComplete();
    }
    String json = "[";
    bool first = true;
    for (int i = 0; i < n; i++) {
      String s = WiFi.SSID(i);
      if (s.isEmpty()) continue;
      if (!first) json += ",";
      json += "{\"ssid\":\"" + _jesc(s) + "\",\"rssi\":" + WiFi.RSSI(i)
            + ",\"open\":" + (WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "true" : "false") + "}";
      first = false;
    }
    json += "]";
    WiFi.scanDelete();
    _srv.send(200, "application/json", json);
  }

  void _hConnect() {
    if (!_srv.hasArg("ssid")) {
      _srv.send(400, "text/plain", "missing ssid");
      return;
    }
    _pSSID  = _srv.arg("ssid");
    _pPass  = _srv.arg("pass");
    WiFi.disconnect(true);
    delay(100);
    WiFi.begin(_pSSID.c_str(), _pPass.c_str());
    _pStart = millis();
    _pState = P_CONNECTING;
    Serial.printf("[Portal] Connecting: %s\n", _pSSID.c_str());
    _srv.send(200, "application/json", "{\"status\":\"connecting\"}");
  }

  void _hStatus() {
    String j;
    if (_pState == P_CONNECTED) {
      j = "{\"status\":\"connected\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
    } else if (_pState == P_CONNECTING) {
      j = "{\"status\":\"connecting\"}";
    } else if (_pState == P_FAILED) {
      _pState = P_IDLE;
      j = "{\"status\":\"failed\"}";
    } else {
      j = "{\"status\":\"idle\"}";
    }
    _srv.send(200, "application/json", j);
  }

  // =========================================================
  //  Khởi động AP + WebServer + DNS
  // =========================================================
  void _startPortal() {
    WiFi.mode(WIFI_AP_STA);  // AP_STA để vừa host AP vừa scan/connect STA

    // Tên AP dựa trên MAC (unique mỗi thiết bị)
    uint8_t mac[6];
    WiFi.softAPmacAddress(mac);
    String apName = String(WCFG_AP_PREFIX)
                  + String(mac[4], HEX)
                  + String(mac[5], HEX);
    apName.toUpperCase();
    WiFi.softAP(apName.c_str());  // Không có mật khẩu → điện thoại tự mở portal
    delay(200);

    // DNS server: bắt tất cả domain → 192.168.4.1
    _dns.start(53, "*", WiFi.softAPIP());

    // HTTP routes
    _srv.on("/",             [this] { _hRoot(); });
    _srv.on("/generate_204", [this] { _hRoot(); });  // Android captive check
    _srv.on("/fwlink",       [this] { _hRoot(); });  // Windows captive check
    _srv.on("/scan",    HTTP_GET,  [this] { _hScan(); });
    _srv.on("/connect", HTTP_POST, [this] { _hConnect(); });
    _srv.on("/status",  HTTP_GET,  [this] { _hStatus(); });
    _srv.onNotFound([this] { _hRoot(); });
    _srv.begin();

    _mode   = WIFI_MODE_AP;
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
    if (s.isEmpty()) return false;
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
      Serial.printf("\n[WifiCfg] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
      return true;
    }
    Serial.printf("\n[WifiCfg] %s failed.\n", label);
    return false;
  }

public:
  // Constructor
  WifiConfigClass()
    : _srv(80), _mode(WIFI_MODE_AP),
      _lastPress(0), _blinkTime(0), _pState(P_IDLE) {}

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
        } else if (WiFi.status() == WL_CONNECTED
                   && WiFi.localIP() != IPAddress(0, 0, 0, 0)) {
          Serial.printf("[Portal] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
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
    Serial.printf("[WifiCfg] Ready! IP: %s\n", WiFi.localIP().toString().c_str());
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
  int    getMode() const { return _mode; }

  // Gọi từ WiFiEvent / taskNetwork khi mất/có kết nối
  void setMode(int m) { _mode = m; }
};

// ---- Global instance ----
WifiConfigClass wifiConfig;

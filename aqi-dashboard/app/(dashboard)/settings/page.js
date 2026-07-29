"use client";

import { useState, useEffect } from "react";

function getAQIColor(aqi) {
  if (aqi == null) return "#94a3b8";
  if (aqi <= 50)  return "#059669";
  if (aqi <= 100) return "#d97706";
  if (aqi <= 150) return "#ea580c";
  if (aqi <= 200) return "#dc2626";
  if (aqi <= 300) return "#7c3aed";
  return "#9f1239";
}

function getAQILabel(aqi) {
  if (aqi == null) return "—";
  if (aqi <= 50)  return "Tốt";
  if (aqi <= 100) return "Trung bình";
  if (aqi <= 150) return "Kém";
  if (aqi <= 200) return "Xấu";
  if (aqi <= 300) return "Rất xấu";
  return "Nguy hại";
}

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const STORAGE_KEY = "aqi_alert_settings";
const COOLDOWN_KEY = "aqi_alert_last_sent";

const defaultSettings = {
  alertEnabled: true,
  email: "",
  phone: "",
  aqiThreshold: 100,
  alertCooldown: 5,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Load from localStorage & check SW
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings(JSON.parse(saved));
      const ls = localStorage.getItem(COOLDOWN_KEY);
      if (ls) setLastSent(new Date(ls));
    } catch {}

    if (typeof window !== "undefined" && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        });
      }).catch(console.error);
    }
  }, []);

  const saveSettings = async () => {
    if (settings.alertEnabled && !settings.email) {
      showToast("Vui lòng nhập Địa chỉ Email để kích hoạt nhận mail.", true);
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      
      const res = await fetch("/api/alert/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: settings.email,
          alertEnabled: settings.alertEnabled,
          aqiThreshold: settings.aqiThreshold,
          alertCooldown: settings.alertCooldown,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Đã lưu cài đặt & kích hoạt thông báo!");
      } else {
        showToast(data.error || "Lỗi khi đồng bộ với server.", true);
      }
    } catch (e) {
      console.error(e);
      showToast("Lỗi khi lưu cài đặt.", true);
    } finally {
      setSaving(false);
    }
  };

  const testEmailAlert = async () => {
    if (!settings.email) {
      showToast("Hãy nhập địa chỉ Email trước khi gửi thử.", true);
      return;
    }
    setTestingEmail(true);
    try {
      const res = await fetch("/api/data?limit=1");
      const data = await res.json();
      const latest = data?.[data.length - 1];

      const sendRes = await fetch("/api/alert/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: settings.email,
          aqi: latest?.aqi ?? 0,
          threshold: settings.aqiThreshold,
          metrics: latest,
        }),
      });
      const result = await sendRes.json();
      if (result.success && result.results?.email === "sent") {
        showToast(`Đã gửi email thử nghiệm đến ${settings.email}`);
        localStorage.setItem(COOLDOWN_KEY, new Date().toISOString());
        setLastSent(new Date());
      } else {
        showToast(result.error || "Không thể gửi email. Hãy kiểm tra biến GMAIL trên server.", true);
      }
    } catch (e) {
      showToast("Lỗi kết nối server.", true);
    } finally {
      setTestingEmail(false);
    }
  };

  const subscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      showToast("Trình duyệt không hỗ trợ Web Push.", true);
      return;
    }
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        showToast("Quyền thông báo bị chặn trên trình duyệt. Bạn hãy cho phép ở thanh địa chỉ URL!", true);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BH5_fzF0HLX-9qjYr26OHl307AyNGFPoYPbimW1SJKrkr_EgtlqHF0LbMUeCrdOD75zfOJFgOIe5IXvT0xXyIPU";
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      if (res.ok) {
        setIsSubscribed(true);
        showToast("Đã bật thông báo Web Push thành công!");
      } else {
        showToast("Đăng ký Web Push thất bại trên server.", true);
      }
    } catch (e) {
      console.error("Push subscribe error:", e);
      showToast(`Lỗi cấp quyền: ${e.message || "Không thể bật Web Push."}`, true);
    }
  };

  const showToast = (msg, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 4000);
  };

  const set = (key, val) => setSettings((s) => ({ ...s, [key]: val }));
  const thresholdColor = getAQIColor(settings.aqiThreshold);

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="border-b border-gray-100 pb-5">
        <h1 className="text-[20px] md:text-[22px] font-bold text-gray-900 tracking-tight uppercase">
          CÀI ĐẶT THÔNG BÁO & CẢNH BÁO
        </h1>
        <p className="text-[13px] text-gray-500 mt-1">
          Thiết lập độc lập các kênh nhận cảnh báo (Email & Web Push) và tùy chỉnh ngưỡng kích hoạt AQI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: 2 Notification Channels */}
        <div className="lg:col-span-7 space-y-6">

          {/* KÊNH 1: EMAIL NOTIFICATIONS */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">1. Cảnh Báo Qua Email</h3>
                  <p className="text-[12px] text-gray-400">Gửi mail tự động khi AQI vượt ngưỡng</p>
                </div>
              </div>

              {/* Email Toggle */}
              <button
                onClick={() => set("alertEnabled", !settings.alertEnabled)}
                className={`relative w-12 h-6.5 rounded-full transition-colors duration-300 cursor-pointer shrink-0 ${settings.alertEnabled ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <div className={`absolute top-0.5 w-5.5 h-5.5 rounded-full bg-white shadow-md transition-all duration-300 ${settings.alertEnabled ? "left-[23px]" : "left-0.5"}`} />
              </button>
            </div>

            {settings.alertEnabled ? (
              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Địa chỉ Email Nhận Cảnh Báo
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-500 transition-all bg-gray-50/50">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    <input
                      type="email"
                      placeholder="example@gmail.com"
                      value={settings.email}
                      onChange={(e) => set("email", e.target.value)}
                      className="flex-1 bg-transparent outline-none text-[13.5px] text-gray-800 placeholder:text-gray-300 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-[11.5px] font-semibold rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    {settings.email ? "Đã sẵn sàng nhận Mail" : "Nhập Email để kích hoạt"}
                  </span>

                  <button
                    onClick={testEmailAlert}
                    disabled={testingEmail || !settings.email}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[12.5px] font-semibold rounded-xl transition-all cursor-pointer shadow-sm shadow-blue-500/20"
                  >
                    {testingEmail ? "Đang gửi..." : "✉️ Gửi thử Email"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-gray-400 italic">Đã tắt kênh nhận cảnh báo qua Email.</p>
            )}
          </div>

          {/* KÊNH 2: WEB PUSH NOTIFICATIONS */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">2. Thông Báo Đẩy Trình Duyệt (Web Push)</h3>
                  <p className="text-[12px] text-gray-400">Hiển thị thông báo góc màn hình máy tính/điện thoại</p>
                </div>
              </div>

              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${isSubscribed ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                {isSubscribed ? "Đã bật Push" : "Chưa đăng ký"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <p className="text-[12.5px] text-gray-500 leading-relaxed max-w-sm">
                Tính năng này đẩy pop-up thông báo trực tiếp qua Chrome/Edge mà không cần mở tab Dashboard.
              </p>

              <button
                onClick={subscribePush}
                disabled={isSubscribed}
                className={`px-5 py-2.5 rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-sm ${
                  isSubscribed 
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200" 
                    : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/20"
                }`}
              >
                {isSubscribed ? "✓ Đã Đăng Ký Push" : "🔔 Bật Web Push"}
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Threshold & Cooldown */}
        <div className="lg:col-span-5 space-y-6">

          {/* AQI THRESHOLD */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">NGƯỠNG AQI BẮT ĐẦU CẢNH BÁO</p>
            
            <div className="flex items-end gap-3 mb-5">
              <div className="text-[52px] font-black leading-none tracking-tight" style={{ color: thresholdColor }}>
                {settings.aqiThreshold}
              </div>
              <span className="mb-2 inline-block px-3 py-1 rounded-lg text-[12px] font-bold text-white shadow-sm" style={{ backgroundColor: thresholdColor }}>
                {getAQILabel(settings.aqiThreshold)}
              </span>
            </div>

            <input type="range" min={30} max={300} step={10}
              value={settings.aqiThreshold}
              onChange={(e) => set("aqiThreshold", Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer mb-2"
              style={{ background: `linear-gradient(to right, #059669 0%,#d97706 20%,#ea580c 40%,#dc2626 60%,#7c3aed 80%,#9f1239 100%)` }}
            />

            <div className="flex justify-between text-[11px] text-gray-400 font-medium px-0.5 mb-5">
              <span>30</span><span>100</span><span>150</span><span>200</span><span>300+</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[{v:50,l:"50 · Tốt"},{v:100,l:"100 · Trung Bình"},{v:150,l:"150 · Kém"},{v:200,l:"200 · Xấu"}].map((p) => (
                <button key={p.v} onClick={() => set("aqiThreshold", p.v)}
                  className={`py-2 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${
                    settings.aqiThreshold === p.v ? "bg-gray-900 text-white border-gray-900 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}>{p.l}</button>
              ))}
            </div>
          </div>

          {/* COOLDOWN */}
          <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-6">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">THỜI GIAN GIÃN CÁCH GIỮA CÁC LẦN GỬI</p>
            <p className="text-[12px] text-gray-400 mb-4">Khoảng nghỉ tối thiểu trước khi phát đợt thông báo kế tiếp</p>
            
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[{v:5,l:"5p"},{v:15,l:"15p"},{v:30,l:"30p"},{v:60,l:"1h"},{v:180,l:"3h"}].map((o) => (
                <button key={o.v} onClick={() => set("alertCooldown", o.v)}
                  className={`py-2.5 rounded-xl text-[12.5px] font-bold border-2 transition-all cursor-pointer ${
                    settings.alertCooldown === o.v ? "bg-gray-900 text-white border-gray-900 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}>{o.l}</button>
              ))}
            </div>

            {lastSent && (
              <p className="text-[11.5px] text-gray-400 mt-4 pt-3 border-t border-gray-100 font-medium">
                Lần gửi gần nhất: {lastSent.toLocaleString("vi-VN")}
              </p>
            )}
          </div>

          {/* SAVE BUTTON */}
          <button 
            onClick={saveSettings} 
            disabled={saving}
            className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-bold rounded-2xl transition-all shadow-lg shadow-gray-900/15 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Đang lưu cấu hình..." : "💾 Lưu Cấu Hình Cảnh Báo"}
          </button>

        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 max-w-sm px-5 py-3.5 rounded-2xl shadow-2xl text-[13px] font-bold z-50 ${
          toast.err ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`} style={{ animation: "fadeUp 0.2s ease-out" }}>
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance:none; width:20px; height:20px; border-radius:50%;
          background:white; border:2.5px solid #1e293b; box-shadow:0 2px 6px rgba(0,0,0,0.2); cursor:pointer;
        }
      `}</style>
    </div>
  );
}

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
  alertEnabled: false,
  email: "",
  phone: "",
  aqiThreshold: 100,
  alertCooldown: 30,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
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

  const saveSettings = () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      showToast("Đã lưu cài đặt.");
    } catch {
      showToast("Lỗi khi lưu.", true);
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  const testAlert = async () => {
    if (!settings.email && !settings.phone) {
      showToast("Nhập email hoặc số điện thoại trước.", true);
      return;
    }
    setTesting(true);
    try {
      // Fetch current AQI
      const res = await fetch("/api/data?limit=1");
      const data = await res.json();
      const latest = data?.[data.length - 1];

      const sendRes = await fetch("/api/alert/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: settings.email || undefined,
          phone: settings.phone || undefined,
          aqi: latest?.aqi ?? 0,
          threshold: settings.aqiThreshold,
          metrics: latest,
        }),
      });
      const result = await sendRes.json();
      if (result.success) {
        const msgs = [];
        if (result.results?.email === "sent") msgs.push("Email đã gửi");
        if (result.results?.phone) msgs.push("SMS đã ghi nhận");
        if (result.results?.webpush === "sent") msgs.push("Web Push đã gửi");
        showToast(msgs.join(" · ") || "Đã xử lý.");
        localStorage.setItem(COOLDOWN_KEY, new Date().toISOString());
        setLastSent(new Date());
      } else {
        showToast(result.error || "Lỗi khi gửi.", true);
      }
    } catch (e) {
      showToast("Lỗi kết nối.", true);
    } finally {
      setTesting(false);
    }
  };

  const showToast = (msg, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 4000);
  };

  const set = (key, val) => setSettings((s) => ({ ...s, [key]: val }));
  const thresholdColor = getAQIColor(settings.aqiThreshold);
  const hasContact = settings.email || settings.phone || isSubscribed;

  const subscribePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast("Trình duyệt không hỗ trợ Web Push.", true);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const publicKey = "BH5_fzF0HLX-9qjYr26OHl307AyNGFPoYPbimW1SJKrkr_EgtlqHF0LbMUeCrdOD75zfOJFgOIe5IXvT0xXyIPU";
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
        showToast("Đã bật thông báo thành công!");
      } else {
        showToast("Đăng ký thất bại trên server.", true);
      }
    } catch (e) {
      console.error(e);
      showToast("Lỗi khi cấp quyền thông báo.", true);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8 border-b border-gray-100 pb-5">
        <h1 className="text-[20px] md:text-[22px] font-bold text-gray-900 tracking-tight uppercase">CÀI ĐẶT CẢNH BÁO</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-5">

      {/* Enable toggle */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13.5px] font-semibold text-gray-800">Bật cảnh báo</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Tự động gửi thông báo khi AQI vượt ngưỡng</p>
          </div>
          <button
            onClick={() => set("alertEnabled", !settings.alertEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer flex-shrink-0 ${settings.alertEnabled ? "bg-gray-900" : "bg-gray-200"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${settings.alertEnabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Contact info */}
      {settings.alertEnabled && (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Thông tin liên hệ</p>
        <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
          Điền email, số điện thoại hoặc cả hai. Hệ thống sẽ gửi cảnh báo qua phương thức bạn cung cấp.
        </p>

        <div className="space-y-3">
          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Địa chỉ Email
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-gray-300 focus-within:border-gray-400 transition-all bg-white">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input
                type="email"
                placeholder="example@gmail.com"
                value={settings.email}
                onChange={(e) => set("email", e.target.value)}
                className="flex-1 bg-transparent outline-none text-[13px] text-gray-700 placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Số điện thoại
              <span className="ml-1.5 text-[10px] font-normal text-gray-300 normal-case">(Cần tích hợp SMS provider)</span>
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-gray-300 focus-within:border-gray-400 transition-all bg-white">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <input
                type="tel"
                placeholder="0912 345 678"
                value={settings.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="flex-1 bg-transparent outline-none text-[13px] text-gray-700 placeholder:text-gray-300"
              />
            </div>
          </div>
        </div>

        {/* Method summary */}
        {hasContact && (
          <div className="mt-4 pt-3.5 border-t border-gray-100 flex flex-wrap gap-2">
            {settings.email && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-[11.5px] font-medium rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                Gửi Email
              </span>
            )}
            {settings.phone && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-[11.5px] font-medium rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                Gửi SMS
              </span>
            )}
            {isSubscribed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-[11.5px] font-medium rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
                Web Push
              </span>
            )}
          </div>
        )}
      </div>
      )}

      {/* Web Push */}
      {settings.alertEnabled && (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 flex items-center justify-between">
        <div>
          <p className="text-[13.5px] font-semibold text-gray-800">Thông báo trực tiếp</p>
          <p className="text-[12px] text-gray-400 mt-0.5 max-w-[200px] sm:max-w-xs">Nhận cảnh báo qua popup trình duyệt (không cần mở tab)</p>
        </div>
        <button
          onClick={subscribePush}
          disabled={isSubscribed}
          className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-colors ${
            isSubscribed ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
          }`}
        >
          {isSubscribed ? "Đã bật" : "Bật Push"}
        </button>
      </div>
      )}
      
      {!settings.alertEnabled && (
        <div className="flex flex-col items-center justify-center p-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          <p className="text-[13px] text-gray-400 font-medium">Bật cảnh báo để định cấu hình thông báo</p>
        </div>
      )}

        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-5">

      {/* AQI Threshold */}
      {settings.alertEnabled && (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Ngưỡng AQI</p>
        <div className="flex items-end gap-3 mb-5">
          <div className="text-[48px] font-bold leading-none tracking-tight" style={{ color: thresholdColor }}>
            {settings.aqiThreshold}
          </div>
          <span className="mb-1.5 inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold text-white" style={{ backgroundColor: thresholdColor }}>
            {getAQILabel(settings.aqiThreshold)}
          </span>
        </div>
        <input type="range" min={30} max={300} step={10}
          value={settings.aqiThreshold}
          onChange={(e) => set("aqiThreshold", Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer mb-2"
          style={{ background: `linear-gradient(to right, #059669 0%,#d97706 17%,#ea580c 33%,#dc2626 50%,#7c3aed 67%,#9f1239 100%)` }}
        />
        <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
          <span>30</span><span>100</span><span>150</span><span>200</span><span>300</span>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {[{v:50,l:"50 · Tốt"},{v:100,l:"100 · TB"},{v:150,l:"150 · Kém"},{v:200,l:"200 · Xấu"}].map((p) => (
            <button key={p.v} onClick={() => set("aqiThreshold", p.v)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer ${
                settings.aqiThreshold === p.v ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}>{p.l}</button>
          ))}
        </div>
      </div>
      )}

      {/* Cooldown */}
      {settings.alertEnabled && (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Thời gian chờ</p>
        <p className="text-[12px] text-gray-400 mb-4">Khoảng cách tối thiểu giữa hai lần gửi cảnh báo</p>
        <div className="grid grid-cols-4 gap-2">
          {[{v:15,l:"15 phút"},{v:30,l:"30 phút"},{v:60,l:"1 giờ"},{v:180,l:"3 giờ"}].map((o) => (
            <button key={o.v} onClick={() => set("alertCooldown", o.v)}
              className={`px-3 py-2.5 rounded-lg text-[12.5px] font-medium border-2 transition-all cursor-pointer ${
                settings.alertCooldown === o.v ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}>{o.l}</button>
          ))}
        </div>
        {lastSent && (
          <p className="text-[11.5px] text-gray-400 mt-3.5 pt-3 border-t border-gray-100">
            Lần gửi gần nhất: {lastSent.toLocaleString("vi-VN")}
          </p>
        )}
      </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={saveSettings} disabled={saving}
          className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-medium rounded-xl transition-all shadow-md shadow-gray-900/10 disabled:opacity-50 cursor-pointer">
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
        <button onClick={testAlert} disabled={testing || !settings.alertEnabled || !hasContact}
          className="flex-1 py-3 bg-white hover:bg-gray-50 text-gray-700 text-[13px] font-medium rounded-xl border border-gray-200 transition-all shadow-sm disabled:opacity-40 cursor-pointer">
          {testing ? "Đang gửi..." : "Gửi thử"}
        </button>
      </div>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 max-w-sm px-5 py-3 rounded-xl shadow-lg text-[13px] font-medium z-50 ${
          toast.err ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`} style={{ animation: "fadeUp 0.2s ease-out" }}>
          {toast.msg}
        </div>
      )}
      <style jsx>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance:none; width:18px; height:18px; border-radius:50%;
          background:white; border:2px solid #374151; box-shadow:0 1px 4px rgba(0,0,0,0.15); cursor:pointer;
        }
      `}</style>
    </div>
  );
}

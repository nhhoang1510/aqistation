"use client";

import { useSession, signIn } from "next-auth/react";
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

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState({
    alertEnabled: false,
    aqiThreshold: 100,
    alertCooldown: 30,
    lastAlertSent: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (status === "authenticated") fetchSettings();
    if (status === "unauthenticated") setLoading(false);
  }, [status]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/alert/settings");
      if (res.ok) setSettings(await res.json());
    } finally { setLoading(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/alert/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      showToast(res.ok ? "Đã lưu cài đặt." : "Lỗi khi lưu.", !res.ok);
    } finally { setSaving(false); }
  };

  const testAlert = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/alert/check", { method: "POST" });
      const d = await res.json();
      showToast(
        d.alertsSent > 0
          ? `Đã gửi email cảnh báo (AQI: ${d.currentAQI}).`
          : `Không gửi: AQI hiện tại (${d.currentAQI ?? "N/A"}) chưa vượt ngưỡng hoặc đang trong thời gian chờ.`
      );
    } finally { setTesting(false); }
  };

  const showToast = (msg, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 4000);
  };

  const thresholdColor = getAQIColor(settings.aqiThreshold);
  const thresholdLabel = getAQILabel(settings.aqiThreshold);

  // Not logged in
  if (status === "unauthenticated") {
    return (
      <div className="p-5 md:p-8">
        <div className="mb-7">
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Cài đặt cảnh báo</h1>
          <p className="text-sm text-gray-400 mt-0.5">Quản lý ngưỡng cảnh báo và thông báo qua email</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-12 text-center max-w-md">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-[15px] font-semibold text-gray-800 mb-1.5">Yêu cầu đăng nhập</h2>
          <p className="text-[13px] text-gray-400 mb-5 leading-relaxed">
            Đăng nhập bằng Google để cấu hình nhận cảnh báo email khi AQI vượt ngưỡng.
          </p>
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-medium rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Đăng nhập với Google
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-5 md:p-8 flex items-center gap-3 text-gray-400 text-[13px]">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        Đang tải...
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl">

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Cài đặt cảnh báo</h1>
        <p className="text-sm text-gray-400 mt-0.5">Quản lý ngưỡng cảnh báo và thông báo qua email</p>
      </div>

      {/* User card */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Tài khoản</p>
        <div className="flex items-center gap-3">
          {session?.user?.image ? (
            <img src={session.user.image} alt="" className="w-9 h-9 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-white text-sm font-semibold">
              {session?.user?.name?.[0]}
            </div>
          )}
          <div>
            <p className="text-[13.5px] font-semibold text-gray-800">{session?.user?.name}</p>
            <p className="text-[12px] text-gray-400">{session?.user?.email}</p>
          </div>
        </div>
        <p className="text-[11.5px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
          Email cảnh báo sẽ được gửi đến địa chỉ trên.
        </p>
      </div>

      {/* Alert toggle */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13.5px] font-semibold text-gray-800">Bật cảnh báo email</p>
            <p className="text-[12px] text-gray-400 mt-0.5">Nhận thông báo khi chỉ số AQI vượt ngưỡng đã cài đặt</p>
          </div>
          <button
            onClick={() => setSettings((s) => ({ ...s, alertEnabled: !s.alertEnabled }))}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer flex-shrink-0 ${
              settings.alertEnabled ? "bg-gray-900" : "bg-gray-200"
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${
              settings.alertEnabled ? "left-[22px]" : "left-0.5"
            }`} />
          </button>
        </div>
      </div>

      {/* Threshold */}
      <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-4 transition-opacity ${settings.alertEnabled ? "" : "opacity-40 pointer-events-none"}`}>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Ngưỡng AQI</p>

        <div className="flex items-end gap-3 mb-5">
          <div className="text-[48px] font-bold leading-none tracking-tight" style={{ color: thresholdColor }}>
            {settings.aqiThreshold}
          </div>
          <div className="mb-1.5">
            <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold text-white" style={{ backgroundColor: thresholdColor }}>
              {thresholdLabel}
            </span>
          </div>
        </div>

        <input
          type="range" min={30} max={300} step={10}
          value={settings.aqiThreshold}
          onChange={(e) => setSettings((s) => ({ ...s, aqiThreshold: Number(e.target.value) }))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer mb-2"
          style={{
            background: `linear-gradient(to right, #059669 0%,#d97706 17%,#ea580c 33%,#dc2626 50%,#7c3aed 67%,#9f1239 100%)`
          }}
        />
        <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
          <span>30</span><span>100</span><span>150</span><span>200</span><span>300</span>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {[{ v: 50, l: "Tốt · 50" }, { v: 100, l: "TB · 100" }, { v: 150, l: "Kém · 150" }, { v: 200, l: "Xấu · 200" }].map((p) => (
            <button key={p.v}
              onClick={() => setSettings((s) => ({ ...s, aqiThreshold: p.v }))}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all cursor-pointer ${
                settings.aqiThreshold === p.v
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Cooldown */}
      <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-5 transition-opacity ${settings.alertEnabled ? "" : "opacity-40 pointer-events-none"}`}>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Thời gian chờ giữa các lần gửi</p>
        <p className="text-[12px] text-gray-400 mb-4">Sau khi gửi một email, hệ thống sẽ chờ trước khi gửi tiếp</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[{ v: 15, l: "15 phút" }, { v: 30, l: "30 phút" }, { v: 60, l: "1 giờ" }, { v: 180, l: "3 giờ" }].map((o) => (
            <button key={o.v}
              onClick={() => setSettings((s) => ({ ...s, alertCooldown: o.v }))}
              className={`px-4 py-2.5 rounded-lg text-[13px] font-medium border-2 transition-all cursor-pointer ${
                settings.alertCooldown === o.v
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        {settings.lastAlertSent && (
          <p className="text-[11.5px] text-gray-400 mt-4 pt-3 border-t border-gray-100">
            Lần gửi gần nhất: {new Date(settings.lastAlertSent).toLocaleString("vi-VN")}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={saveSettings} disabled={saving}
          className="flex-1 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer">
          {saving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
        <button onClick={testAlert} disabled={testing || !settings.alertEnabled}
          className="flex-1 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-600 text-[13px] font-medium rounded-lg border border-gray-200 transition-colors disabled:opacity-40 cursor-pointer">
          {testing ? "Đang gửi..." : "Gửi email thử"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 max-w-sm px-5 py-3 rounded-xl shadow-lg text-[13px] font-medium z-50 ${
          toast.err ? "bg-red-600 text-white" : "bg-gray-900 text-white"
        }`} style={{ animation: "fadeUp 0.25s ease-out" }}>
          {toast.msg}
        </div>
      )}
      <style jsx>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance:none; width:18px; height:18px; border-radius:50%;
          background:white; border:2px solid #374151; box-shadow:0 1px 4px rgba(0,0,0,0.15); cursor:pointer;
        }
      `}</style>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { data: session } = useSession();
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
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/alert/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error("Error fetching settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/alert/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertEnabled: settings.alertEnabled,
          aqiThreshold: settings.aqiThreshold,
          alertCooldown: settings.alertCooldown,
        }),
      });
      if (res.ok) {
        showToast("✅ Đã lưu cài đặt thành công!");
      } else {
        showToast("❌ Lỗi khi lưu cài đặt", true);
      }
    } catch (e) {
      showToast("❌ Lỗi kết nối", true);
    } finally {
      setSaving(false);
    }
  };

  const testAlert = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/alert/check", { method: "POST" });
      const data = await res.json();
      if (data.alertsSent > 0) {
        showToast(`✅ Đã gửi ${data.alertsSent} email cảnh báo thử!`);
      } else {
        showToast(`ℹ️ Không gửi email: AQI hiện tại (${data.currentAQI || 'N/A'}) chưa vượt ngưỡng hoặc đang trong cooldown`);
      }
    } catch (e) {
      showToast("❌ Lỗi khi gửi email thử", true);
    } finally {
      setTesting(false);
    }
  };

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const getAQILabel = (aqi) => {
    if (aqi <= 50) return { label: "Tốt", color: "#10b981" };
    if (aqi <= 100) return { label: "Trung bình", color: "#eab308" };
    if (aqi <= 150) return { label: "Kém", color: "#f97316" };
    if (aqi <= 200) return { label: "Xấu", color: "#ef4444" };
    if (aqi <= 300) return { label: "Rất xấu", color: "#a855f7" };
    return { label: "Nguy hại", color: "#9f1239" };
  };

  const thresholdInfo = getAQILabel(settings.aqiThreshold);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8"
      style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">⚙️ Cài đặt cảnh báo</h1>
          <p className="text-slate-500 text-sm mt-1">
            Cấu hình nhận email cảnh báo khi chất lượng không khí xấu
          </p>
        </div>

        {/* User Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              <img src={session.user.image} alt="" className="w-14 h-14 rounded-full ring-2 ring-emerald-500/30" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                {session?.user?.name?.[0]}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800 text-lg">{session?.user?.name}</p>
              <p className="text-slate-500 text-sm">{session?.user?.email}</p>
              <p className="text-xs text-slate-400 mt-1">📧 Email cảnh báo sẽ được gửi đến địa chỉ này</p>
            </div>
          </div>
        </div>

        {/* Alert Toggle */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                🔔 Bật cảnh báo email
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Nhận email khi AQI vượt ngưỡng đã cài đặt
              </p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, alertEnabled: !s.alertEnabled }))}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 cursor-pointer ${
                settings.alertEnabled ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                settings.alertEnabled ? "left-7.5" : "left-0.5"
              }`} />
            </button>
          </div>
        </div>

        {/* Threshold Setting */}
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-opacity ${
          settings.alertEnabled ? "opacity-100" : "opacity-50 pointer-events-none"
        }`}>
          <h2 className="font-semibold text-slate-800 text-lg mb-1">📏 Ngưỡng AQI</h2>
          <p className="text-slate-500 text-sm mb-5">
            Gửi cảnh báo khi AQI đạt hoặc vượt giá trị này
          </p>

          {/* AQI Value Display */}
          <div className="text-center mb-4">
            <span className="text-5xl font-black" style={{ color: thresholdInfo.color }}>
              {settings.aqiThreshold}
            </span>
            <div className="text-sm font-semibold mt-1" style={{ color: thresholdInfo.color }}>
              {thresholdInfo.label}
            </div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={30}
            max={300}
            step={10}
            value={settings.aqiThreshold}
            onChange={(e) => setSettings(s => ({ ...s, aqiThreshold: Number(e.target.value) }))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #10b981 0%, #eab308 17%, #f97316 33%, #ef4444 50%, #a855f7 67%, #9f1239 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
            <span>30</span><span>100</span><span>150</span><span>200</span><span>300</span>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {[
              { value: 50, label: "Tốt (50)" },
              { value: 100, label: "TB (100)" },
              { value: 150, label: "Kém (150)" },
              { value: 200, label: "Xấu (200)" },
            ].map((preset) => (
              <button
                key={preset.value}
                onClick={() => setSettings(s => ({ ...s, aqiThreshold: preset.value }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  settings.aqiThreshold === preset.value
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cooldown Setting */}
        <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-opacity ${
          settings.alertEnabled ? "opacity-100" : "opacity-50 pointer-events-none"
        }`}>
          <h2 className="font-semibold text-slate-800 text-lg mb-1">⏰ Thời gian chờ (Cooldown)</h2>
          <p className="text-slate-500 text-sm mb-4">
            Sau khi gửi 1 email, chờ bao lâu mới gửi email tiếp theo
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: 15, label: "15 phút" },
              { value: 30, label: "30 phút" },
              { value: 60, label: "1 giờ" },
              { value: 180, label: "3 giờ" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSettings(s => ({ ...s, alertCooldown: option.value }))}
                className={`px-4 py-3 rounded-xl text-sm font-medium border-2 transition-all cursor-pointer ${
                  settings.alertCooldown === option.value
                    ? "bg-emerald-50 text-emerald-700 border-emerald-500"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {settings.lastAlertSent && (
            <p className="text-xs text-slate-400 mt-4">
              📧 Email cảnh báo cuối cùng: {new Date(settings.lastAlertSent).toLocaleString("vi-VN")}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex-1 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Đang lưu..." : "💾 Lưu cài đặt"}
          </button>
          <button
            onClick={testAlert}
            disabled={testing || !settings.alertEnabled}
            className="flex-1 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            {testing ? "Đang gửi..." : "📨 Gửi email thử"}
          </button>
        </div>

      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 max-w-sm px-5 py-3 rounded-xl shadow-2xl text-sm font-medium z-50 ${
          toast.isError ? "bg-red-500 text-white" : "bg-slate-800 text-white"
        }`}
          style={{ animation: "fadeSlideUp 0.3s ease-out" }}>
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          border: 3px solid #334155;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

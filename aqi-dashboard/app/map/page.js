"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamic import: Leaflet PHẢI chạy trên client (cần window)
const MapComponent = dynamic(() => import("@/app/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 rounded-2xl">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-slate-300 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Đang tải bản đồ...</p>
      </div>
    </div>
  ),
});

function getAQIConfig(aqi) {
  if (aqi == null) return { label: "N/A", color: "#94a3b8", emoji: "⏳" };
  if (aqi <= 50) return { label: "Tốt", color: "#10b981", emoji: "😊" };
  if (aqi <= 100) return { label: "Trung bình", color: "#eab308", emoji: "😐" };
  if (aqi <= 150) return { label: "Kém", color: "#f97316", emoji: "😷" };
  if (aqi <= 200) return { label: "Xấu", color: "#ef4444", emoji: "🤢" };
  if (aqi <= 300) return { label: "Rất xấu", color: "#a855f7", emoji: "🤮" };
  return { label: "Nguy hại", color: "#9f1239", emoji: "☠️" };
}

export default function MapPage() {
  const [latestData, setLatestData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/data?limit=1");
        const data = await res.json();
        if (data && data.length > 0) setLatestData(data[data.length - 1]);
      } catch (e) {
        console.error("Error:", e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const aqiConfig = getAQIConfig(latestData?.aqi);

  return (
    <div className="min-h-screen bg-gray-100"
      style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">🗺️ Bản đồ trạm quan trắc</h1>
            <p className="text-slate-500 text-sm mt-1">Vị trí trạm AQI trên OpenStreetMap</p>
          </div>

          {/* Live AQI Badge */}
          {latestData && (
            <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-2.5">
              <span className="text-2xl">{aqiConfig.emoji}</span>
              <div>
                <div className="text-xs text-slate-500 font-medium">AQI hiện tại</div>
                <div className="text-xl font-black" style={{ color: aqiConfig.color }}>
                  {latestData.aqi} <span className="text-sm font-semibold">— {aqiConfig.label}</span>
                </div>
              </div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse ml-2" />
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
          style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
          <MapComponent />
        </div>

        {/* Info Cards below map */}
        {latestData && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              { icon: "🌫️", label: "PM2.5", value: `${latestData.pm2_5} µg/m³` },
              { icon: "🌫️", label: "PM10", value: `${latestData.pm10} µg/m³` },
              { icon: "🌡️", label: "Nhiệt độ", value: `${latestData.temperature?.toFixed(1)}°C` },
              { icon: "💧", label: "Độ ẩm", value: `${latestData.humidity?.toFixed(1)}%` },
              { icon: "⏱️", label: "Áp suất", value: `${latestData.pressure?.toFixed(0)} hPa` },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
                <div className="text-xs text-slate-500 mb-1">{m.icon} {m.label}</div>
                <div className="font-bold text-slate-800">{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

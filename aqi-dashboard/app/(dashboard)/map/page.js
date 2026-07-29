"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-50 rounded-xl">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[12px] text-gray-400">Đang tải bản đồ...</p>
      </div>
    </div>
  ),
});

function getAQIConfig(aqi) {
  if (aqi == null) return { label: "—", color: "#94a3b8", bg: "#f8fafc" };
  if (aqi <= 50)  return { label: "Tốt",       color: "#059669", bg: "#ecfdf5" };
  if (aqi <= 100) return { label: "Trung bình", color: "#d97706", bg: "#fffbeb" };
  if (aqi <= 150) return { label: "Kém",        color: "#ea580c", bg: "#fff7ed" };
  if (aqi <= 200) return { label: "Xấu",        color: "#dc2626", bg: "#fef2f2" };
  if (aqi <= 300) return { label: "Rất xấu",    color: "#7c3aed", bg: "#f5f3ff" };
  return           { label: "Nguy hại",          color: "#9f1239", bg: "#fff1f2" };
}

export default function MapPage() {
  const [latest, setLatest] = useState(null);
  const [isLive, setIsLive] = useState(null);

  useEffect(() => {
    const fetch_data = async () => {
      try {
        const res = await fetch("/api/data?limit=1");
        const data = await res.json();
        if (data?.length > 0) {
          setLatest(data[data.length - 1]);
          setIsLive(Date.now() - new Date(data[data.length - 1].timestamp).getTime() < 30000);
        }
      } catch { setIsLive(false); }
    };
    fetch_data();
    const id = setInterval(fetch_data, 10000);
    return () => clearInterval(id);
  }, []);

  const cfg = getAQIConfig(latest?.aqi);

  const metrics = [
    { label: "PM2.5",    value: latest?.pm2_5,               unit: "µg/m³" },
    { label: "PM10",     value: latest?.pm10,                unit: "µg/m³" },
    { label: "Nhiệt độ", value: latest?.temperature?.toFixed(1), unit: "°C" },
    { label: "Độ ẩm",    value: latest?.humidity?.toFixed(1), unit: "%" },
    { label: "Áp suất",  value: latest?.pressure?.toFixed(0), unit: "hPa" },
    { label: "Gas VOC",  value: latest?.gas_resistance?.toFixed(0), unit: "kΩ" },
  ];

  return (
    <div className="p-5 md:p-8 flex flex-col" style={{ minHeight: "calc(100vh - 0px)" }}>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[20px] md:text-[22px] font-bold text-gray-900 tracking-tight uppercase">BẢN ĐỒ TRẠM</h1>
      </div>



      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm flex-1" style={{ minHeight: "540px", height: "calc(100vh - 220px)", position: "relative" }}>
        <MapComponent />
      </div>
    </div>
  );
}

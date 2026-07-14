"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function getAQIConfig(aqi) {
  if (aqi == null) return { label: "--", color: "#94a3b8", bg: "#f1f5f9", textColor: "#475569" };
  if (aqi <= 50)  return { label: "Tốt",       color: "#059669", bg: "#ecfdf5", textColor: "#065f46" };
  if (aqi <= 100) return { label: "Trung bình",   color: "#d97706", bg: "#fffbeb", textColor: "#b45309" };
  if (aqi <= 150) return { label: "Kém", color: "#ea580c", bg: "#fff7ed", textColor: "#c2410c" };
  if (aqi <= 200) return { label: "Xấu",  color: "#dc2626", bg: "#fef2f2", textColor: "#b91c1c" };
  if (aqi <= 300) return { label: "Rất xấu", color: "#7c3aed", bg: "#f5f3ff", textColor: "#6d28d9" };
  return { label: "Nguy hại", color: "#9f1239", bg: "#fff1f2", textColor: "#881337" };
}

function getMarkerPosition(aqi) {
  if (aqi == null) return 0;
  let p = 0;
  if (aqi <= 50) p = (aqi / 50) * 20;
  else if (aqi <= 100) p = 20 + ((aqi - 50) / 50) * 20;
  else if (aqi <= 150) p = 40 + ((aqi - 100) / 50) * 20;
  else if (aqi <= 200) p = 60 + ((aqi - 150) / 50) * 20;
  else p = 80 + (Math.min(aqi - 200, 100) / 100) * 20;
  return Math.max(0, Math.min(100, p));
}

function getFaceIcon(aqi) {
  if (aqi == null) return null;
  const cx = "w-[160px] h-[160px] md:w-[200px] md:h-[200px] drop-shadow-2xl transition-transform hover:scale-105 duration-300";
  if (aqi <= 50) return ( // Good
    <svg viewBox="0 0 100 100" className={cx}>
       <circle cx="50" cy="50" r="48" fill="#FDE047" stroke="#111827" strokeWidth="4.5"/>
       <circle cx="20" cy="55" r="9" fill="#FCA5A5" opacity="0.8"/>
       <circle cx="80" cy="55" r="9" fill="#FCA5A5" opacity="0.8"/>
       <path d="M 30 40 Q 35 30 40 40" fill="none" stroke="#111827" strokeWidth="4.5" strokeLinecap="round"/>
       <path d="M 60 40 Q 65 30 70 40" fill="none" stroke="#111827" strokeWidth="4.5" strokeLinecap="round"/>
       <path d="M 30 60 Q 50 85 70 60" fill="none" stroke="#111827" strokeWidth="5.5" strokeLinecap="round"/>
    </svg>
  );
  if (aqi <= 100) return ( // Moderate
    <svg viewBox="0 0 100 100" className={cx}>
       <circle cx="50" cy="50" r="48" fill="#FDE047" stroke="#111827" strokeWidth="4.5"/>
       <circle cx="35" cy="40" r="4.5" fill="#111827"/>
       <circle cx="65" cy="40" r="4.5" fill="#111827"/>
       <path d="M 35 65 L 65 65" fill="none" stroke="#111827" strokeWidth="5.5" strokeLinecap="round"/>
    </svg>
  );
  if (aqi <= 150) return ( // Poor
    <svg viewBox="0 0 100 100" className={cx}>
       <circle cx="50" cy="50" r="48" fill="#FDBA74" stroke="#111827" strokeWidth="4.5"/>
       <circle cx="35" cy="45" r="4.5" fill="#111827"/>
       <circle cx="65" cy="45" r="4.5" fill="#111827"/>
       <path d="M 35 70 Q 50 55 65 70" fill="none" stroke="#111827" strokeWidth="5.5" strokeLinecap="round"/>
    </svg>
  );
  if (aqi <= 200) return ( // Unhealthy
    <svg viewBox="0 0 100 100" className={cx}>
       <circle cx="50" cy="50" r="48" fill="#FCA5A5" stroke="#111827" strokeWidth="4.5"/>
       <path d="M 30 35 L 40 45 M 40 35 L 30 45" stroke="#111827" strokeWidth="4.5" strokeLinecap="round"/>
       <path d="M 60 35 L 70 45 M 70 35 L 60 45" stroke="#111827" strokeWidth="4.5" strokeLinecap="round"/>
       <path d="M 30 70 Q 40 60 50 70 T 70 70" fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
  return ( // Severe/Hazardous
    <svg viewBox="0 0 100 100" className={cx}>
       <circle cx="50" cy="50" r="48" fill="#D8B4FE" stroke="#111827" strokeWidth="4.5"/>
       <path d="M 30 35 L 40 45 M 40 35 L 30 45" stroke="#111827" strokeWidth="4.5" strokeLinecap="round"/>
       <path d="M 60 35 L 70 45 M 70 35 L 60 45" stroke="#111827" strokeWidth="4.5" strokeLinecap="round"/>
       <ellipse cx="50" cy="70" rx="10" ry="15" fill="#111827"/>
    </svg>
  );
}

function getWifiIcon(rssi) {
  if (rssi == null) return null;
  let bars = 0;
  if (rssi > -60) bars = 4;
  else if (rssi > -70) bars = 3;
  else if (rssi > -80) bars = 2;
  else if (rssi > -90) bars = 1;
  return (
    <div className="flex items-end gap-[1.5px] h-3.5" title={`WiFi RSSI: ${rssi} dBm`}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={`w-[3px] rounded-sm ${i <= bars ? "bg-[#0f172a]" : "bg-gray-200"}`} style={{ height: `${i * 25}%` }} />
      ))}
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} ngày ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

// Minimal SVG icons — no emoji
const icons = {
  pm: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>,
  temp: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
  humidity: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1M4.22 4.22l.707.707M18.364 18.364l.707.707M1 12h1M21 12h1M4.22 19.778l.707-.707M18.364 5.636l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>,
  pressure: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  gas: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  clock: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  map: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  list: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
};

export default function Dashboard() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [timeLimit, setTimeLimit] = useState(60);
  const [isLive, setIsLive] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore from localStorage
  useEffect(() => {
    try {
      const savedLimit = localStorage.getItem("aqi_dashboard_timelimit");
      if (savedLimit) setTimeLimit(Number(savedLimit));
      
      const savedLatest = localStorage.getItem("aqi_dashboard_latest");
      if (savedLatest) setLatest(JSON.parse(savedLatest));
    } catch {}
  }, []);

  const handleTimeLimitChange = (v) => {
    setTimeLimit(v);
    try { localStorage.setItem("aqi_dashboard_timelimit", v); } catch {}
  };

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/data?limit=${timeLimit}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data);
      if (data?.length > 0) {
        const currentLatest = data[data.length - 1];
        setLatest(currentLatest);
        setIsLive(Date.now() - new Date(currentLatest.timestamp).getTime() < 30000);
        try { localStorage.setItem("aqi_dashboard_latest", JSON.stringify(currentLatest)); } catch {}
      } else {
        setIsLive(false);
      }
      fetch("/api/alert/check", { method: "POST" }).catch(() => {});
    } catch {
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [timeLimit]);

  const aqiConfig = getAQIConfig(latest?.aqi);

  const lastUpdated = latest?.timestamp
    ? new Date(latest.timestamp).toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    : "--";

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: false,
        grid: { color: "rgba(0,0,0,0.04)" },
        ticks: { font: { size: 11, family: "Be Vietnam Pro" }, color: "#9ca3af" },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, family: "Be Vietnam Pro" }, color: "#9ca3af", maxTicksLimit: 12 },
        border: { display: false },
      },
    },
  };

  const labels = history.map((d) => {
    const t = new Date(d.timestamp);
    return `${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`;
  });

  const makeChart = (key, color) => ({
    labels,
    datasets: [{
      data: history.map((d) => d[key]),
      borderColor: color,
      backgroundColor: color + "14",
      fill: true, tension: 0.4, borderWidth: 1.8,
      pointRadius: history.length > 100 ? 0 : 2,
      pointBackgroundColor: color,
    }],
  });

  const stats = [
    { label: "PM2.5",       value: latest?.pm2_5,               unit: "µg/m³", icon: icons.pm,       sub: "Bụi mịn" },
    { label: "PM10",        value: latest?.pm10,                unit: "µg/m³", icon: icons.pm,       sub: "Bụi thô" },
    { label: "Nhiệt độ",    value: latest?.temperature?.toFixed(1), unit: "°C", icon: icons.temp,    sub: "BME680" },
    { label: "Độ ẩm",       value: latest?.humidity?.toFixed(1), unit: "%RH",  icon: icons.humidity, sub: "Tương đối" },
    { label: "Áp suất",     value: latest?.pressure?.toFixed(0), unit: "hPa",  icon: icons.pressure, sub: "Khí quyển" },
    { label: "Gas VOC",     value: latest?.gas_resistance?.toFixed(0), unit: "kΩ", icon: icons.gas, sub: "Điện trở" },
  ];

  const charts = [
    { label: "PM2.5",    key: "pm2_5",        color: "#e11d48" },
    { label: "PM10",     key: "pm10",         color: "#d97706" },
    { label: "Nhiệt độ", key: "temperature",  color: "#ef4444" },
    { label: "Độ ẩm",    key: "humidity",     color: "#2563eb" },
    { label: "Áp suất",  key: "pressure",     color: "#7c3aed" },
    { label: "Gas VOC",  key: "gas_resistance",color: "#059669" },
  ];

  return (
    <div className="p-5 md:p-8">

      {/* Hero Redesign */}
      <div className="bg-white rounded-[24px] shadow-sm mb-6 flex flex-col overflow-hidden border border-gray-100">
        
        {/* Top Header */}
        <div className="px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between bg-white border-b border-gray-50 z-20 relative gap-4 md:gap-0">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5 mt-2">
              <h1 className="text-[20px] md:text-[22px] font-bold text-[#0f172a] tracking-tight uppercase leading-none">
                TRẠM QUAN TRẮC CHẤT LƯỢNG KHÔNG KHÍ ĐA THÔNG SỐ
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 text-[10.5px] font-bold uppercase tracking-wider rounded-md border border-blue-100 shadow-sm">
                Trạm 01
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px] md:text-[13px] text-gray-500 font-medium">
              Cập nhật lúc: {lastUpdated}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(isLive && latest?.wifi_rssi != null) && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                {getWifiIcon(latest.wifi_rssi)}
                <span className="text-[11px] font-bold text-gray-500 ml-0.5">{latest.wifi_rssi} dBm</span>
              </div>
            )}
            {(isLive && latest?.uptime != null) && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[11px] font-bold text-gray-500">Hoạt động: {formatUptime(latest.uptime)}</span>
              </div>
            )}
            {(!isLive && latest && !loading) && (
              <span className="text-[11.5px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 flex items-center gap-1.5 shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Dữ liệu cũ (Cache)
              </span>
            )}
            <div className={`px-4 py-1.5 rounded-full border flex items-center gap-2 shadow-sm ${isLive ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-red-200 bg-red-50 text-red-600"}`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <span className="text-[12.5px] font-bold tracking-wide">{isLive ? "Trực tuyến" : "Ngoại tuyến"}</span>
            </div>
          </div>
        </div>

        {/* Main Content Area (AQI Card) */}
        <div className="p-6 md:p-8 bg-white">
          <div className="mb-2">
            <span className="text-[14px] md:text-[15px] font-medium text-gray-600">
              Chỉ số AQI hiện tại
            </span>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="text-[72px] md:text-[84px] font-normal leading-none tracking-tight text-gray-900">
              {latest?.aqi ?? "—"}
            </div>
            <div className="px-4 py-1.5 rounded-xl text-[14px] font-medium border border-black/5" style={{ backgroundColor: aqiConfig.bg, color: aqiConfig.textColor }}>
              {aqiConfig.label}
            </div>
          </div>

          {/* Scale Bar */}
          <div className="w-full mt-8 md:mt-10">
            <div className="relative h-3.5 md:h-4 rounded-full w-full mb-3" style={{ background: 'linear-gradient(to right, #65a30d 0%, #ca8a04 20%, #ea580c 40%, #dc2626 60%, #9f1239 80%, #78350f 100%)' }}>
              {/* Marker Overlay */}
              <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
                <div className="h-[180%] w-[3px] bg-gray-900 absolute top-[-40%] transition-all duration-500 ease-out z-20" style={{ left: `calc(${getMarkerPosition(latest?.aqi)}% - 1.5px)` }} />
              </div>
            </div>
            <div className="flex justify-between text-[12px] md:text-[13px] text-gray-500 font-medium px-1">
              <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300+</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="text-[14px] font-medium text-gray-600 mb-1.5">PM2.5</div>
          <div className="text-[28px] md:text-[32px] font-medium text-gray-900">{latest?.pm2_5 ?? "--"} <span className="text-[14px] text-gray-500 ml-0.5">µg/m³</span></div>
        </div>
        <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="text-[14px] font-medium text-gray-600 mb-1.5">PM10</div>
          <div className="text-[28px] md:text-[32px] font-medium text-gray-900">{latest?.pm10 ?? "--"} <span className="text-[14px] text-gray-500 ml-0.5">µg/m³</span></div>
        </div>
        <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="text-[14px] font-medium text-gray-600 mb-1.5">Nhiệt độ</div>
          <div className="text-[28px] md:text-[32px] font-medium text-gray-900">{latest?.temperature?.toFixed(0) ?? "--"}°C</div>
        </div>
        <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="text-[14px] font-medium text-gray-600 mb-1.5">Độ ẩm</div>
          <div className="text-[28px] md:text-[32px] font-medium text-gray-900">{latest?.humidity?.toFixed(0) ?? "--"}%</div>
        </div>
      </div>

      {/* Charts */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900 tracking-tight">Biểu đồ theo thời gian</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">Xu hướng các thông số quan trắc</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-[12.5px] text-gray-500 font-medium shadow-sm">
          {icons.clock}
          <select
            className="bg-transparent border-none outline-none cursor-pointer appearance-none pr-3 text-[12.5px] font-medium text-gray-600"
            value={timeLimit}
            onChange={(e) => handleTimeLimitChange(Number(e.target.value))}
          >
            <option value="15">1 phút</option>
            <option value="60">5 phút</option>
            <option value="360">30 phút</option>
            <option value="720">1 giờ</option>
            <option value="4320">6 giờ</option>
            <option value="17280">24 giờ</option>
          </select>
          <span className="text-gray-400 pointer-events-none -ml-3">▾</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {charts.map((c, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold text-gray-700">{c.label}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
            </div>
            <div className="h-[160px]">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-[13px] font-medium text-gray-400">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                  Đang tải dữ liệu...
                </div>
              ) : history.length > 0 ? (
                <Line data={makeChart(c.key, c.color)} options={chartOpts} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[13px] font-medium text-gray-400">
                  <svg className="w-6 h-6 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  Chưa có dữ liệu
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

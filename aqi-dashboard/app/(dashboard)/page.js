"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const [dismissAlert, setDismissAlert] = useState(false);

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
        if (currentLatest.aqi >= 100) {
          fetch("/api/alert/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aqi: currentLatest.aqi,
              level: getAQIConfig(currentLatest.aqi).label,
              pm2_5: currentLatest.pm2_5,
              pm10: currentLatest.pm10,
              message: `Cảnh báo AQI = ${currentLatest.aqi} (${getAQIConfig(currentLatest.aqi).label})`,
            })
          }).catch(() => {});
        }
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
        ticks: { font: { size: 10, family: "Be Vietnam Pro" }, color: "#9ca3af", maxTicksLimit: 8 },
        border: { display: false },
      },
    },
  };

  const makeChart = (key, color) => ({
    labels: history.map((d) =>
      new Date(d.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    ),
    datasets: [
      {
        data: history.map((d) => d[key]),
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 160);
          gradient.addColorStop(0, `${color}25`);
          gradient.addColorStop(1, `${color}00`);
          return gradient;
        },
      },
    ],
  });

  const charts = [
    { label: "Biến thiên AQI", key: "aqi", color: aqiConfig.color },
    { label: "Nồng độ PM2.5",  key: "pm2_5", color: "#dc2626" },
    { label: "Nồng độ PM10",   key: "pm10",  color: "#ea580c" },
    { label: "Nhiệt độ (°C)", key: "temp",  color: "#d97706" },
    { label: "Độ ẩm (%)",     key: "humidity", color: "#2563eb" },
    { label: "Áp suất (hPa)", key: "pressure", color: "#7c3aed" },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">

      {/* Slide-in Right Alert Notification Toast */}
      {latest?.aqi >= 100 && !dismissAlert && (
        <div 
          className="fixed top-20 right-5 z-50 max-w-sm sm:max-w-md bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 text-white p-4 rounded-2xl shadow-2xl border border-white/20 flex items-start justify-between gap-3 overflow-hidden backdrop-blur-md"
          style={{ animation: "slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 text-xl font-bold">
              ⚠️
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-[14px]">
                <span className="tracking-tight uppercase">CẢNH BÁO AQI: {latest.aqi}</span>
                <span className="px-2 py-0.5 rounded-md bg-white/25 text-[10.5px] font-extrabold uppercase">
                  {aqiConfig.label}
                </span>
              </div>
              <p className="text-[12px] text-white/95 mt-1 font-medium leading-snug">
                PM2.5: <strong>{latest.pm2_5} µg/m³</strong> · PM10: <strong>{latest.pm10} µg/m³</strong>. Không khí đang ở ngưỡng nguy hại!
              </p>
            </div>
          </div>
          <button 
            onClick={() => setDismissAlert(true)}
            className="text-white/70 hover:text-white text-lg font-bold p-1 leading-none shrink-0 cursor-pointer"
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* OUTLIER LAYOUT HEADER SECTION */}
      <div className="space-y-3">
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-orange-600 hover:text-orange-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {/* Station Title & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h1 className="text-[28px] sm:text-[36px] font-extrabold text-gray-900 tracking-tight leading-none">
              AQI Station Alpha
            </h1>
            <div className="flex items-center gap-2 text-[12.5px] text-gray-500 font-medium mt-2">
              {icons.clock}
              <span>Cập nhật: {lastUpdated}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {latest?.wifi_rssi != null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl border border-gray-200/80">
                {getWifiIcon(latest.wifi_rssi)}
                <span className="text-[11.5px] font-bold text-gray-600 ml-0.5">{latest.wifi_rssi} dBm</span>
              </div>
            )}
            {(isLive && latest?.uptime != null) && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl border border-gray-200/80">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[11.5px] font-bold text-gray-600">Hoạt động: {formatUptime(latest.uptime)}</span>
              </div>
            )}
            {(!isLive && latest && !loading) && (
              <span className="text-[11.5px] font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Dữ liệu cũ (Cache)
              </span>
            )}
            <div className={`px-4 py-1.5 rounded-full border flex items-center gap-2 shadow-xs ${isLive ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-red-200 bg-red-50 text-red-600"}`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              <span className="text-[12.5px] font-bold tracking-wide">{isLive ? "Trực tuyến" : "Ngoại tuyến"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* OUTLIER LAYOUT: MAIN AQI CARD & 4 STATS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main AQI Card (Left 7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="mb-3">
              <span className="text-[15px] font-bold text-gray-700 uppercase tracking-wider">
                Chỉ số AQI hiện tại
              </span>
            </div>
            
            <div className="flex items-center gap-5 mb-6">
              <div className="text-[72px] sm:text-[84px] font-black leading-none tracking-tight text-gray-900">
                {latest?.aqi ?? "—"}
              </div>
              <div className="px-4 py-2 rounded-xl text-[14.5px] font-bold border shadow-xs" style={{ backgroundColor: aqiConfig.bg, color: aqiConfig.textColor }}>
                {aqiConfig.label}
              </div>
            </div>
          </div>

          {/* Scale Bar */}
          <div className="w-full mt-4">
            <div className="relative h-4 rounded-full w-full mb-3" style={{ background: 'linear-gradient(to right, #65a30d 0%, #ca8a04 20%, #ea580c 40%, #dc2626 60%, #9f1239 80%, #78350f 100%)' }}>
              {/* Marker Overlay */}
              <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none">
                <div className="h-[180%] w-[3px] bg-gray-900 absolute top-[-40%] transition-all duration-500 ease-out z-20 shadow-md" style={{ left: `calc(${getMarkerPosition(latest?.aqi)}% - 1.5px)` }} />
              </div>
            </div>
            <div className="flex justify-between text-[12px] text-gray-500 font-bold px-1">
              <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300+</span>
            </div>
          </div>
        </div>

        {/* 4 Stats Cards Grid (Right 5 Cols) */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-center">
            <div className="text-[13px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">PM2.5</div>
            <div className="text-[26px] sm:text-[30px] font-extrabold text-gray-900">{latest?.pm2_5 ?? "--"} <span className="text-[13px] font-semibold text-gray-400">µg/m³</span></div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-center">
            <div className="text-[13px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">PM10</div>
            <div className="text-[26px] sm:text-[30px] font-extrabold text-gray-900">{latest?.pm10 ?? "--"} <span className="text-[13px] font-semibold text-gray-400">µg/m³</span></div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-center">
            <div className="text-[13px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Nhiệt độ</div>
            <div className="text-[26px] sm:text-[30px] font-extrabold text-gray-900">{(latest?.temperature ?? latest?.temp)?.toFixed(0) ?? "--"}°C</div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-5 flex flex-col justify-center">
            <div className="text-[13px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Độ ẩm</div>
            <div className="text-[26px] sm:text-[30px] font-extrabold text-gray-900">{latest?.humidity?.toFixed(0) ?? "--"}%</div>
          </div>
        </div>

      </div>

      {/* OUTLIER LAYOUT: LOWER SECTION (CHARTS & TIMELIMIT SELECTOR) */}
      <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-[16px] sm:text-[18px] font-bold text-gray-900 tracking-tight">
              Biểu đồ theo thời gian
            </h3>
          </div>
          
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-xl text-[12.5px] text-gray-600 font-bold shadow-xs">
            {icons.clock}
            <select
              className="bg-transparent border-none outline-none cursor-pointer appearance-none pr-3 text-[12.5px] font-bold text-gray-700"
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

        {/* 6 Line Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {charts.map((c, i) => (
            <div key={i} className="bg-gray-50/50 rounded-2xl border border-gray-200/70 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13.5px] font-bold text-gray-800">{c.label}</span>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              </div>
              <div className="h-[160px]">
                {loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-[12.5px] font-medium text-gray-400">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                    Đang tải dữ liệu...
                  </div>
                ) : history.length > 0 ? (
                  <Line data={makeChart(c.key, c.color)} options={chartOpts} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[12.5px] font-medium text-gray-400">
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

      <style jsx>{`
        @keyframes slideInRight { from { transform: translateX(120%); opacity:0; } to { transform: translateX(0); opacity:1; } }
      `}</style>
    </div>
  );
}

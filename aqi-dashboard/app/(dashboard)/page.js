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
    ? new Date(latest.timestamp).toLocaleTimeString("vi-VN", {
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
        ticks: { font: { size: 11 }, color: "#9ca3af" },
        border: { display: false },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: "#9ca3af", maxTicksLimit: 8 },
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

  const sensorMetrics = [
    { label: "Bụi mịn PM2.5", value: latest?.pm2_5, unit: "µg/m³", color: "#dc2626" },
    { label: "Bụi mịn PM10",  value: latest?.pm10,  unit: "µg/m³", color: "#ea580c" },
    { label: "Nhiệt độ",      value: latest?.temp,  unit: "°C",     color: "#d97706" },
    { label: "Độ ẩm",        value: latest?.humidity, unit: "%",    color: "#2563eb" },
    { label: "Áp suất",      value: latest?.pressure, unit: "hPa",  color: "#7c3aed" },
    { label: "Gas VOC",      value: latest?.gas_resistance, unit: "kΩ", color: "#059669" },
  ];

  const charts = [
    { label: "Biến thiên AQI", key: "aqi", color: aqiConfig.color },
    { label: "Nồng độ PM2.5",  key: "pm2_5", color: "#dc2626" },
    { label: "Nồng độ PM10",   key: "pm10",  color: "#ea580c" },
    { label: "Nhiệt độ (°C)", key: "temp",  color: "#d97706" },
    { label: "Độ ẩm (%)",     key: "humidity", color: "#2563eb" },
    { label: "Áp suất (hPa)", key: "pressure", color: "#7c3aed" },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">

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

      {/* Outlier-style Hero Header Section */}
      <div className="space-y-3">
        {/* Back breadcrumb */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-orange-600 hover:text-orange-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {/* Main Station Title */}
        <h1 className="text-[32px] sm:text-[40px] font-extrabold text-gray-900 tracking-tight leading-tight">
          Aether
        </h1>

        {/* Description Paragraph */}
        <p className="text-[14px] sm:text-[15px] text-gray-600 leading-relaxed max-w-4xl font-normal">
          Aether is built for contributors who like quick, simple tasks. Can you look at a picture and describe it? Spot differences between two things? Follow straight-forward instructions? Then you're already ahead. The tasks are short, chunkable, and easy to squeeze between errands, chores, classes — or whatever else you're avoiding. It's a low-lift way to stay sharp and pick up small bursts of work whenever you want to stay active.
        </p>

        {/* Status Badge & Subline */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-[13px] font-bold shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Đang Hoạt Động
          </span>
          <span className="text-[13px] text-gray-500 font-medium">
            This project is 1st in your queue &gt;
          </span>
        </div>
      </div>

      {/* Outlier-style Horizontal Stat Container (Row of 3 cards in wide dark panel) */}
      <div className="bg-gray-900 rounded-3xl p-6 sm:p-8 shadow-xl text-white border border-gray-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-gray-800">
          
          {/* Card 1: Total Earned / AQI */}
          <div className="flex items-center gap-4 pt-4 md:pt-0 first:pt-0">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 border border-gray-700/80 flex items-center justify-center shrink-0 text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-gray-400">Total Earned / AQI</p>
              <div className="text-[32px] sm:text-[36px] font-black tracking-tight leading-none mt-1" style={{ color: aqiConfig.color }}>
                {latest?.aqi ?? "—"}
              </div>
              <p className="text-[12px] font-medium text-gray-400 mt-1">
                Completed 7 tasks · <span className="font-bold text-white">{aqiConfig.label}</span>
              </p>
            </div>
          </div>

          {/* Card 2: Task Completion Time */}
          <div className="flex items-center gap-4 pt-6 md:pt-0 md:pl-8">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 border border-gray-700/80 flex items-center justify-center shrink-0 text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-gray-400">Task Completion Time</p>
              <div className="text-[28px] sm:text-[32px] font-black tracking-tight leading-none text-white mt-1">
                {lastUpdated}
              </div>
              <p className="text-[12px] font-medium text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Truyền Live MQTT
              </p>
            </div>
          </div>

          {/* Card 3: Avg. Feedback Score / PM2.5 */}
          <div className="flex items-center gap-4 pt-6 md:pt-0 md:pl-8">
            <div className="w-12 h-12 rounded-2xl bg-gray-800 border border-gray-700/80 flex items-center justify-center shrink-0 text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-gray-400">Avg. Feedback Score / PM2.5</p>
              <div className="text-[32px] sm:text-[36px] font-black tracking-tight leading-none text-white mt-1">
                {latest?.pm2_5 ?? "—"} <span className="text-[16px] font-bold text-gray-400">µg/m³</span>
              </div>
              <p className="text-[12px] font-medium text-gray-400 mt-1">
                Tiêu chuẩn: &lt; 50 µg/m³
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Project Overview Section */}
      <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-[18px] sm:text-[20px] font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Project Overview
          </h2>
          
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-gray-400 font-medium">Khung thời gian:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {[30, 60, 120].map((t) => (
                <button
                  key={t}
                  onClick={() => handleTimeLimitChange(t)}
                  className={`px-3 py-1 text-[12px] font-bold rounded-lg transition-all cursor-pointer ${
                    timeLimit === t ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {t} phút
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Sensor Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {sensorMetrics.map((m, i) => (
            <div key={i} className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 transition-all hover:bg-gray-50 hover:shadow-xs">
              <span className="text-[11.5px] font-semibold text-gray-500 block truncate">{m.label}</span>
              <div className="text-[22px] font-black text-gray-900 mt-1" style={{ color: m.color }}>
                {m.value != null ? m.value : "—"}
              </div>
              <span className="text-[11px] font-bold text-gray-400">{m.unit}</span>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="pt-4">
          <h3 className="text-[15px] font-bold text-gray-900 mb-4">Biểu Đồ Lịch Sử Diễn Biến</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {charts.map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-bold text-gray-800">{c.label}</span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                </div>
                <div className="h-[150px]">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-[12px] font-medium text-gray-400">
                      Đang tải...
                    </div>
                  ) : history.length > 0 ? (
                    <Line data={makeChart(c.key, c.color)} options={chartOpts} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-[12px] font-medium text-gray-400">
                      Chưa có dữ liệu
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style jsx>{`
        @keyframes slideInRight { from { transform: translateX(120%); opacity:0; } to { transform: translateX(0); opacity:1; } }
      `}</style>
    </div>
  );
}

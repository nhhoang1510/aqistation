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
  if (aqi == null) return { label: "Đang tải", color: "#94a3b8", bg: "#f8fafc", textColor: "#64748b" };
  if (aqi <= 50)  return { label: "Tốt",       color: "#059669", bg: "#ecfdf5", textColor: "#065f46" };
  if (aqi <= 100) return { label: "Trung bình", color: "#d97706", bg: "#fffbeb", textColor: "#92400e" };
  if (aqi <= 150) return { label: "Kém",        color: "#ea580c", bg: "#fff7ed", textColor: "#9a3412" };
  if (aqi <= 200) return { label: "Xấu",        color: "#dc2626", bg: "#fef2f2", textColor: "#991b1b" };
  if (aqi <= 300) return { label: "Rất xấu",    color: "#7c3aed", bg: "#f5f3ff", textColor: "#4c1d95" };
  return           { label: "Nguy hại",          color: "#9f1239", bg: "#fff1f2", textColor: "#881337" };
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

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/data?limit=${timeLimit}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data);
      if (data?.length > 0) {
        const latest = data[data.length - 1];
        setLatest(latest);
        setIsLive(Date.now() - new Date(latest.timestamp).getTime() < 30000);
      } else {
        setIsLive(false);
      }
      fetch("/api/alert/check", { method: "POST" }).catch(() => {});
    } catch {
      setIsLive(false);
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

      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Trang chủ</h1>
        <p className="text-sm text-gray-400 mt-0.5 font-normal">
          Hệ thống quan trắc chất lượng không khí đa thông số
        </p>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mb-5">
        <div className="flex flex-col lg:flex-row">
          {/* Left */}
          <div className="flex-1 p-7">
            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-gray-300"}`} />
              <span className="text-[11px] font-medium text-gray-400 tracking-wide uppercase">
                {isLive ? "Đang hoạt động" : "Ngoại tuyến"} · {lastUpdated}
              </span>
            </div>
            <h2 className="text-[20px] font-semibold text-gray-900 leading-snug mb-2.5 tracking-tight">
              Giám sát chất lượng không khí<br />theo thời gian thực
            </h2>
            <p className="text-[13.5px] text-gray-400 leading-relaxed mb-6 max-w-md font-normal">
              Thu thập và phân tích liên tục các thông số PM2.5, PM10, nhiệt độ, độ ẩm và khí VOC từ trạm cảm biến ESP32.
            </p>
            <div className="flex items-center gap-2.5">
              <a href="/map"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-medium rounded-lg transition-colors">
                {icons.map}
                Xem bản đồ
              </a>
              <a href="/history"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 text-[13px] font-medium rounded-lg border border-gray-200 transition-colors">
                {icons.list}
                Lịch sử
              </a>
            </div>
          </div>

          {/* Right: AQI value */}
          <div
            className="lg:w-[280px] flex flex-col items-center justify-center p-8 border-t lg:border-t-0 lg:border-l border-gray-100"
            style={{ backgroundColor: aqiConfig.bg }}
          >
            <p className="text-[11px] font-medium uppercase tracking-widest mb-3" style={{ color: aqiConfig.color }}>
              Chỉ số AQI
            </p>
            <div className="text-[64px] font-bold leading-none mb-1 tracking-tight" style={{ color: aqiConfig.color }}>
              {latest?.aqi ?? "—"}
            </div>
            <div className="text-[13px] font-medium mb-5" style={{ color: aqiConfig.color }}>
              {aqiConfig.label}
            </div>
            {/* Scale bar */}
            <div className="w-full max-w-[200px]">
              <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                {["#059669","#d97706","#ea580c","#dc2626","#7c3aed","#9f1239"].map((c, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-1.5 font-normal">
                <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300+</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{s.label}</span>
              <span className="text-gray-300">{s.icon}</span>
            </div>
            <div className="text-[22px] font-semibold text-gray-900 leading-none tracking-tight">
              {s.value ?? "—"}
            </div>
            <div className="text-[11px] text-gray-400 mt-1.5">{s.unit} · {s.sub}</div>
          </div>
        ))}
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
            onChange={(e) => setTimeLimit(Number(e.target.value))}
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
              {history.length > 0 ? (
                <Line data={makeChart(c.key, c.color)} options={chartOpts} />
              ) : (
                <div className="h-full flex items-center justify-center text-[12px] text-gray-300">
                  Đang tải dữ liệu...
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

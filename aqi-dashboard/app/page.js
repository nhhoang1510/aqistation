"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.font.family = "Outfit, sans-serif";

function getAQIColor(aqi) {
  if (aqi <= 50) return { bg: "bg-emerald-500", text: "Tốt" };
  if (aqi <= 100) return { bg: "bg-amber-400", text: "Trung bình" };
  if (aqi <= 150) return { bg: "bg-orange-500", text: "Kém" };
  if (aqi <= 200) return { bg: "bg-red-500", text: "Xấu" };
  if (aqi <= 300) return { bg: "bg-purple-500", text: "Rất xấu" };
  return { bg: "bg-rose-900", text: "Nguy hại" };
}

export default function Dashboard() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchData = async () => {
    try {
      const [resLatest, resHistory] = await Promise.all([
        fetch("/api/data/latest").then(res => res.json()),
        fetch("/api/data?limit=15").then(res => res.json())
      ]);
      setLatest(resLatest);
      setHistory(resHistory);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: history.map(d => {
      const date = new Date(d.timestamp);
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
    }),
    datasets: [
      {
        label: "PM 2.5 (µg/m³)",
        data: history.map(d => d.pm2_5),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.4,
        borderWidth: 2
      },
      {
        label: "Nhiệt độ (°C)",
        data: history.map(d => d.temperature),
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.1)",
        fill: true,
        tension: 0.4,
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" } },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" } },
      x: { grid: { display: false } }
    }
  };

  const aqiInfo = getAQIColor(latest?.aqi || 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center" 
         style={{ backgroundImage: "radial-gradient(at 0% 0%, rgba(59,130,246,0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(16,185,129,0.15) 0px, transparent 50%)" }}>
      
      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          AQI Station
        </h1>
        <p className="text-slate-400 mt-2 text-lg flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          Live Data Dashboard
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl mb-12">
        <div className="bg-slate-800/70 backdrop-blur-md border-l-4 border-blue-500 rounded-2xl p-6 shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-4">Chỉ số AQI</div>
          <div className="text-4xl font-bold flex items-center justify-between">
            {latest?.aqi || "--"}
            <span className={`text-xs px-3 py-1 rounded-full text-white ${aqiInfo.bg}`}>
              {aqiInfo.text}
            </span>
          </div>
        </div>

        <div className="bg-slate-800/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-4">Bụi mịn PM 2.5</div>
          <div className="text-4xl font-bold flex items-baseline gap-2">
            {latest?.pm2_5 || "--"} <span className="text-base text-slate-400 font-normal">µg/m³</span>
          </div>
        </div>

        <div className="bg-slate-800/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-4">Nhiệt độ</div>
          <div className="text-4xl font-bold flex items-baseline gap-2">
            {latest?.temperature?.toFixed(1) || "--"} <span className="text-base text-slate-400 font-normal">°C</span>
          </div>
        </div>

        <div className="bg-slate-800/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-4">Độ ẩm</div>
          <div className="text-4xl font-bold flex items-baseline gap-2">
            {latest?.humidity?.toFixed(1) || "--"} <span className="text-base text-slate-400 font-normal">%</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl bg-slate-800/70 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-lg h-[400px]">
        {history.length > 0 ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">Đang tải biểu đồ...</div>
        )}
      </div>
    </div>
  );
}

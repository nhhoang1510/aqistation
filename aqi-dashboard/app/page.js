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
ChartJS.defaults.font.family = "Outfit, sans-serif";

function getAQIConfig(aqi) {
  if (aqi == null) return { label: "Loading...", color: "text-gray-500", bg: "bg-gray-500", gradient: "from-gray-50 to-gray-100", emoji: "⏳", percent: 0 };
  
  const step = 100 / 6; // Vì có 6 dải màu bằng nhau (mỗi dải chiếm 16.66% chiều rộng)
  
  if (aqi <= 50) return { 
    label: "Good", 
    color: "text-emerald-500", 
    bg: "bg-emerald-500", 
    gradient: "from-emerald-50 via-white to-emerald-100/40",
    emoji: "😊",
    percent: (aqi / 50) * step
  };
  if (aqi <= 100) return { 
    label: "Moderate", 
    color: "text-yellow-500", 
    bg: "bg-yellow-500", 
    gradient: "from-yellow-50 via-white to-yellow-100/40",
    emoji: "😐",
    percent: step + ((aqi - 50) / 50) * step
  };
  if (aqi <= 150) return { 
    label: "Poor", 
    color: "text-orange-500", 
    bg: "bg-orange-500", 
    gradient: "from-orange-50 via-white to-orange-100/40",
    emoji: "😷",
    percent: step * 2 + ((aqi - 100) / 50) * step
  };
  if (aqi <= 200) return { 
    label: "Unhealthy", 
    color: "text-red-500", 
    bg: "bg-red-500", 
    gradient: "from-red-50 via-white to-red-100/40",
    emoji: "🤢",
    percent: step * 3 + ((aqi - 150) / 50) * step
  };
  if (aqi <= 300) return { 
    label: "Severe", 
    color: "text-purple-500", 
    bg: "bg-purple-500", 
    gradient: "from-purple-50 via-white to-purple-100/40",
    emoji: "🤮",
    percent: step * 4 + ((aqi - 200) / 100) * step
  };
  return { 
    label: "Hazardous", 
    color: "text-rose-800", 
    bg: "bg-rose-800", 
    gradient: "from-rose-50 via-white to-rose-200/40",
    emoji: "☠️",
    percent: step * 5 + ((Math.min(aqi, 500) - 300) / 200) * step
  };
}

export default function Dashboard() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/data?limit=15");
      if (!res.ok) throw new Error("Lỗi mạng khi tải dữ liệu");
      
      const resHistory = await res.json();
      setHistory(resHistory);
      
      if (resHistory && resHistory.length > 0) {
        setLatest(resHistory[resHistory.length - 1]);
      }
    } catch (e) {
      console.error("Lỗi Fetch Data:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const aqiConfig = getAQIConfig(latest?.aqi);
  
  // Format thời gian
  const lastUpdated = latest?.timestamp 
    ? new Date(latest.timestamp).toLocaleString('vi-VN', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute:'2-digit', second:'2-digit' 
      }) 
    : "--";
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: false, grid: { color: "rgba(0,0,0,0.05)" } },
      x: { grid: { display: false } }
    }
  };

  const labels = history.map(d => {
    const date = new Date(d.timestamp);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  });

  const createChartData = (label, dataKey, color, bgColor) => ({
    labels,
    datasets: [{
      label,
      data: history.map(d => d[dataKey]),
      borderColor: color,
      backgroundColor: bgColor,
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 2
    }]
  });


  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 font-sans text-gray-800"
         style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
      
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Main AQI Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          
          {/* Header Section */}
          <div className="p-6 md:p-8 pb-4 border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">AQI STATION</h1>
                <p className="text-gray-400 text-sm italic mt-1">Last Updated: {lastUpdated} (Local Time)</p>
              </div>
            </div>
          </div>

          {/* Dashboard Gradient Area */}
          <div className={`p-6 md:p-8 bg-gradient-to-b ${aqiConfig.gradient} relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8`}>
            
            {/* Background Decorations (Mây mờ) */}
            <div className="absolute top-0 right-10 w-64 h-32 bg-white/30 rounded-full blur-3xl mix-blend-overlay pointer-events-none"></div>
            <div className="absolute bottom-0 left-10 w-64 h-32 bg-white/40 rounded-full blur-3xl mix-blend-overlay pointer-events-none"></div>
            
            {/* Left: AQI Values */}
            <div className="flex-1 w-full relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${aqiConfig.bg} animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.2)]`}></span>
                <span className="text-gray-600 font-semibold text-sm uppercase tracking-wide">Live AQI</span>
              </div>
              
              <div className="flex items-baseline gap-4 mb-6">
                <span className={`text-7xl md:text-9xl font-black ${aqiConfig.color} drop-shadow-md`}>
                  {latest?.aqi || "--"}
                </span>
                <div className="flex flex-col">
                  <span className="text-gray-500 font-medium text-sm mb-1">Air Quality is</span>
                  <span className={`px-4 py-1 rounded-lg text-lg font-bold bg-white/60 backdrop-blur-sm shadow-sm ${aqiConfig.color}`}>
                    {aqiConfig.label}
                  </span>
                </div>
              </div>

              <div className="flex gap-8 mb-8 text-gray-700">
                <div className="text-lg">
                  <span className="font-bold">PM2.5 : </span> 
                  <span className="text-2xl font-bold">{latest?.pm2_5 || "--"}</span> <span className="text-sm">µg/m³</span>
                </div>
                <div className="text-lg">
                  <span className="font-bold">PM10 : </span> 
                  <span className="text-2xl font-bold">{latest?.pm10 || "--"}</span> <span className="text-sm">µg/m³</span>
                </div>
              </div>

              {/* AQI Scale Bar */}
              <div className="max-w-md w-full">
                <div className="flex justify-between text-[10px] md:text-xs font-semibold text-gray-600 mb-1 px-1">
                  <span>Good</span><span>Moderate</span><span>Poor</span><span>Unhealthy</span><span>Severe</span><span>Hazardous</span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-gray-200 overflow-hidden flex">
                  <div className="h-full flex-1 bg-emerald-500"></div>
                  <div className="h-full flex-1 bg-yellow-500"></div>
                  <div className="h-full flex-1 bg-orange-500"></div>
                  <div className="h-full flex-1 bg-red-500"></div>
                  <div className="h-full flex-1 bg-purple-500"></div>
                  <div className="h-full flex-1 bg-rose-800"></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                  <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300</span><span>301+</span>
                </div>
                {/* Indicator Triangle */}
                <div 
                  className="absolute w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-800 transition-all duration-500"
                  style={{ left: `calc(${aqiConfig.percent}% - 6px)`, bottom: '22px' }}
                ></div>
              </div>
            </div>

            {/* Center: Cartoon / Emoji Character */}
            <div className="hidden md:flex flex-col items-center justify-center relative z-10 mx-4">
              <div className="text-9xl drop-shadow-2xl hover:scale-110 transition-transform duration-300 cursor-pointer">
                {aqiConfig.emoji}
              </div>
            </div>

            {/* Right: Weather Widget Glassmorphism */}
            <div className="w-full md:w-80 bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl drop-shadow-sm">⛅</span>
                  <div>
                    <div className="text-3xl font-bold text-gray-800 flex items-start">
                      {latest?.temperature?.toFixed(1) || "--"} <span className="text-lg mt-1">°C</span>
                    </div>
                    <div className="text-sm font-medium text-gray-600">Cloudy</div>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 shadow-md">
                  ↗
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-gray-300/30 pt-4">
                <div className="text-center">
                  <div className="text-gray-500 text-xs mb-1 font-medium flex items-center justify-center gap-1">💧 Humidity</div>
                  <div className="font-bold text-gray-800 text-sm">{latest?.humidity?.toFixed(1) || "--"} %</div>
                </div>
                <div className="text-center border-l border-gray-300/30">
                  <div className="text-gray-500 text-xs mb-1 font-medium flex items-center justify-center gap-1">⏱️ Pressure</div>
                  <div className="font-bold text-gray-800 text-sm">{latest?.pressure?.toFixed(0) || "--"} hPa</div>
                </div>
                <div className="text-center border-l border-gray-300/30">
                  <div className="text-gray-500 text-xs mb-1 font-medium flex items-center justify-center gap-1">☣️ Gas</div>
                  <div className="font-bold text-gray-800 text-sm">{latest?.gas_resistance?.toFixed(0) || "--"} kΩ</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 h-[300px] flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">Temperature (°C)</h3>
            <div className="flex-1 min-h-0">
              {history.length > 0 ? <Line data={createChartData("Temperature", "temperature", "#ef4444", "rgba(239,68,68,0.1)")} options={chartOptions} /> : <div className="text-gray-400 text-center">Loading...</div>}
            </div>
          </div>
          
          <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 h-[300px] flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">Humidity (%RH)</h3>
            <div className="flex-1 min-h-0">
              {history.length > 0 ? <Line data={createChartData("Humidity", "humidity", "#3b82f6", "rgba(59,130,246,0.1)")} options={chartOptions} /> : <div className="text-gray-400 text-center">Loading...</div>}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 h-[300px] flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">Pressure (hPa)</h3>
            <div className="flex-1 min-h-0">
              {history.length > 0 ? <Line data={createChartData("Pressure", "pressure", "#8b5cf6", "rgba(139,92,246,0.1)")} options={chartOptions} /> : <div className="text-gray-400 text-center">Loading...</div>}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 h-[300px] flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">PM 10 (µg/m³)</h3>
            <div className="flex-1 min-h-0">
              {history.length > 0 ? <Line data={createChartData("PM 10", "pm10", "#f59e0b", "rgba(245,158,11,0.1)")} options={chartOptions} /> : <div className="text-gray-400 text-center">Loading...</div>}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 h-[300px] flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">Gas Resistance (kΩ)</h3>
            <div className="flex-1 min-h-0">
              {history.length > 0 ? <Line data={createChartData("Gas", "gas_resistance", "#10b981", "rgba(16,185,129,0.1)")} options={chartOptions} /> : <div className="text-gray-400 text-center">Loading...</div>}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 h-[300px] flex flex-col">
            <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">MQ135 Analog (Raw)</h3>
            <div className="flex-1 min-h-0">
              {history.length > 0 ? <Line data={createChartData("MQ135", "mq135", "#64748b", "rgba(100,116,139,0.1)")} options={chartOptions} /> : <div className="text-gray-400 text-center">Loading...</div>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

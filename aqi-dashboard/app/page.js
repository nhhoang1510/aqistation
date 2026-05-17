"use client";

import { useEffect, useState } from "react";


function getAQIConfig(aqi) {
  if (aqi == null) return { label: "Đang tải...", color: "text-gray-500", bg: "bg-gray-500", gradient: "from-gray-50 to-gray-100", emoji: "⏳", percent: 0 };
  
  if (aqi <= 50) return { 
    label: "Tốt (Good)", 
    color: "text-emerald-500", 
    bg: "bg-emerald-500", 
    gradient: "from-emerald-50 via-white to-emerald-100/40",
    emoji: "😊",
    percent: (aqi / 500) * 100
  };
  if (aqi <= 100) return { 
    label: "Trung bình (Moderate)", 
    color: "text-yellow-500", 
    bg: "bg-yellow-500", 
    gradient: "from-yellow-50 via-white to-yellow-100/40",
    emoji: "😐",
    percent: (aqi / 500) * 100
  };
  if (aqi <= 150) return { 
    label: "Kém (Poor)", 
    color: "text-orange-500", 
    bg: "bg-orange-500", 
    gradient: "from-orange-50 via-white to-orange-100/40",
    emoji: "😷",
    percent: (aqi / 500) * 100
  };
  if (aqi <= 200) return { 
    label: "Xấu (Unhealthy)", 
    color: "text-red-500", 
    bg: "bg-red-500", 
    gradient: "from-red-50 via-white to-red-100/40",
    emoji: "🤢",
    percent: (aqi / 500) * 100
  };
  if (aqi <= 300) return { 
    label: "Rất xấu (Severe)", 
    color: "text-purple-500", 
    bg: "bg-purple-500", 
    gradient: "from-purple-50 via-white to-purple-100/40",
    emoji: "🤮",
    percent: (aqi / 500) * 100
  };
  return { 
    label: "Nguy hại (Hazardous)", 
    color: "text-rose-800", 
    bg: "bg-rose-800", 
    gradient: "from-rose-50 via-white to-rose-200/40",
    emoji: "☠️",
    percent: Math.min((aqi / 500) * 100, 100)
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
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Real-time Air Quality Index (AQI)</h1>
                <p className="text-blue-600 font-medium text-lg mt-1 cursor-pointer hover:underline">Trạm Quan Trắc ĐH Bách Khoa, Hà Nội</p>
                <p className="text-gray-400 text-sm italic mt-1">Cập nhật lần cuối: {lastUpdated} (Local Time)</p>
              </div>
              <div className="hidden md:flex gap-3">
                <button className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50 transition">
                  📍 Locate me
                </button>
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
                    <div className="text-sm font-medium text-gray-600">Trời Nhiều Mây</div>
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 shadow-md">
                  ↗
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-gray-300/30 pt-4">
                <div className="text-center">
                  <div className="text-gray-500 text-xs mb-1 font-medium flex items-center justify-center gap-1">💧 Độ ẩm</div>
                  <div className="font-bold text-gray-800 text-sm">{latest?.humidity?.toFixed(1) || "--"} %</div>
                </div>
                <div className="text-center border-l border-gray-300/30">
                  <div className="text-gray-500 text-xs mb-1 font-medium flex items-center justify-center gap-1">⏱️ Áp suất</div>
                  <div className="font-bold text-gray-800 text-sm">{latest?.pressure?.toFixed(0) || "--"} hPa</div>
                </div>
                <div className="text-center border-l border-gray-300/30">
                  <div className="text-gray-500 text-xs mb-1 font-medium flex items-center justify-center gap-1">☣️ Khí Gas</div>
                  <div className="font-bold text-gray-800 text-sm">{latest?.gas_resistance?.toFixed(0) || "--"} kΩ</div>
                </div>
              </div>
            </div>

          </div>
        </div>



      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function getAQIColor(aqi) {
  if (aqi <= 50) return "#10b981";
  if (aqi <= 100) return "#eab308";
  if (aqi <= 150) return "#f97316";
  if (aqi <= 200) return "#ef4444";
  if (aqi <= 300) return "#a855f7";
  return "#9f1239";
}

export default function HistoryPage() {
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data/history?from=${fromDate}&to=${toDate}&page=${p}&pageSize=50`);
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
        setStats(result.stats);
        setPage(result.page);
        setTotalPages(result.totalPages);
        setTotal(result.total);
      }
    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, []);

  const handleSearch = () => {
    fetchHistory(1);
  };

  const exportCSV = () => {
    if (data.length === 0) return;

    const headers = "timestamp,pm2_5,pm10,temperature,humidity,pressure,gas_resistance,mq135,aqi";
    const rows = data.map(d =>
      `${d.timestamp},${d.pm2_5},${d.pm10},${d.temperature},${d.humidity},${d.pressure},${d.gas_resistance},${d.mq135},${d.aqi}`
    );
    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aqi_data_${fromDate}_to_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (ts) => {
    return new Date(ts).toLocaleString("vi-VN", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      day: "2-digit", month: "2-digit"
    });
  };

  // Chart data
  const chartData = {
    labels: data.map(d => {
      const date = new Date(d.timestamp);
      return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
    }),
    datasets: [
      {
        label: "AQI",
        data: data.map(d => d.aqi),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: data.length > 100 ? 0 : 2,
      },
      {
        label: "PM2.5",
        data: data.map(d => d.pm2_5),
        borderColor: "#ec4899",
        backgroundColor: "transparent",
        tension: 0.3,
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [4, 4],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top", labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" } },
      x: { grid: { display: false }, ticks: { maxTicksLimit: 20 } },
    },
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8"
      style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">📋 Lịch sử dữ liệu</h1>
            <p className="text-slate-500 text-sm mt-1">Xem và xuất dữ liệu đo đạc theo ngày</p>
          </div>
        </div>

        {/* Date Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Từ ngày</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Đến ngày</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Đang tải..." : "🔍 Tìm kiếm"}
            </button>
            <button
              onClick={exportCSV}
              disabled={data.length === 0}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            >
              📥 Xuất CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Tổng bản ghi", value: total.toLocaleString(), icon: "📊", color: "text-slate-700" },
              { label: "AQI trung bình", value: stats.avgAqi?.toFixed(0) || "--", icon: "📈", color: `text-[${getAQIColor(stats.avgAqi)}]` },
              { label: "AQI cao nhất", value: stats.maxAqi || "--", icon: "⬆️", color: "text-red-500" },
              { label: "PM2.5 TB", value: stats.avgPm25?.toFixed(1) || "--", icon: "🌫️", color: "text-pink-500" },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="text-xs text-slate-500 font-medium mb-1">{s.icon} {s.label}</div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        {data.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-slate-700 mb-4">📈 Biểu đồ AQI & PM2.5</h2>
            <div className="h-[300px]">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Thời gian", "AQI", "PM2.5", "PM10", "Nhiệt độ", "Độ ẩm", "Áp suất", "Gas", "MQ135"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                      {loading ? "Đang tải dữ liệu..." : "Không có dữ liệu. Chọn ngày và nhấn Tìm kiếm."}
                    </td>
                  </tr>
                ) : (
                  data.map((d, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap font-mono text-xs">{formatTimestamp(d.timestamp)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold text-white"
                          style={{ backgroundColor: getAQIColor(d.aqi) }}>
                          {d.aqi}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{d.pm2_5}</td>
                      <td className="px-4 py-2.5 text-slate-700">{d.pm10}</td>
                      <td className="px-4 py-2.5 text-slate-700">{d.temperature?.toFixed(1)}°C</td>
                      <td className="px-4 py-2.5 text-slate-700">{d.humidity?.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-slate-700">{d.pressure?.toFixed(0)} hPa</td>
                      <td className="px-4 py-2.5 text-slate-700">{d.gas_resistance?.toFixed(1)} kΩ</td>
                      <td className="px-4 py-2.5 text-slate-700">{d.mq135}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Trang {page}/{totalPages} · {total.toLocaleString()} bản ghi
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchHistory(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  ← Trước
                </button>
                <button
                  onClick={() => fetchHistory(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

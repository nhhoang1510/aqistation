"use client";

import { useState, useEffect } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

function getAQIColor(aqi) {
  if (aqi == null) return "#94a3b8";
  if (aqi <= 50)  return "#059669";
  if (aqi <= 100) return "#d97706";
  if (aqi <= 150) return "#ea580c";
  if (aqi <= 200) return "#dc2626";
  if (aqi <= 300) return "#7c3aed";
  return "#9f1239";
}

function getAQILabel(aqi) {
  if (aqi == null) return "—";
  if (aqi <= 50)  return "Tốt";
  if (aqi <= 100) return "Trung bình";
  if (aqi <= 150) return "Kém";
  if (aqi <= 200) return "Xấu";
  if (aqi <= 300) return "Rất xấu";
  return "Nguy hại";
}

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
  scales: {
    y: {
      beginAtZero: false,
      grid: { color: "rgba(0,0,0,0.04)" },
      ticks: { font: { size: 11, family: "Be Vietnam Pro" }, color: "#9ca3af" },
      border: { display: false },
    },
    x: {
      grid: { display: false },
      ticks: { font: { size: 10, family: "Be Vietnam Pro" }, color: "#9ca3af", maxTicksLimit: 16 },
      border: { display: false },
    },
  },
};

const columns = [
  { key: "timestamp", label: "Thời gian",    fmt: (v) => new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" }) },
  { key: "aqi",          label: "AQI",        fmt: (v) => v },
  { key: "pm2_5",        label: "PM2.5",      fmt: (v) => v, unit: "µg/m³" },
  { key: "pm10",         label: "PM10",       fmt: (v) => v, unit: "µg/m³" },
  { key: "temperature",  label: "Nhiệt độ",   fmt: (v) => v?.toFixed(1), unit: "°C" },
  { key: "humidity",     label: "Độ ẩm",      fmt: (v) => v?.toFixed(1), unit: "%" },
  { key: "pressure",     label: "Áp suất",    fmt: (v) => v?.toFixed(0), unit: "hPa" },
  { key: "gas_resistance",label:"Gas VOC",    fmt: (v) => v?.toFixed(1), unit: "kΩ" },
  { key: "mq135",        label: "MQ-135",     fmt: (v) => v, unit: "ADC" },
];

const HISTORY_STORAGE_KEY = "aqi_history_state";

export default function HistoryPage() {
  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState(today);
  const [to, setTo]   = useState(today);
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // ── Khôi phục trạng thái từ localStorage khi vào trang ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.from) setFrom(s.from);
        if (s.to)   setTo(s.to);
        if (s.data?.length) {
          setData(s.data);
          setStats(s.stats);
          setPage(s.page ?? 1);
          setTotalPages(s.totalPages ?? 0);
          setTotal(s.total ?? 0);
          setSearched(true);
        }
      }
    } catch {}
  }, []);

  const saveToStorage = (state) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state));
    } catch {}
  };

  const fetchHistory = async (p = 1, fromVal = from, toVal = to) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data/history?from=${fromVal}&to=${toVal}&page=${p}&pageSize=50`);
      if (res.ok) {
        const r = await res.json();
        setData(r.data);
        setStats(r.stats);
        setPage(r.page);
        setTotalPages(r.totalPages);
        setTotal(r.total);
        setSearched(true);
        // Lưu trạng thái vào localStorage
        saveToStorage({
          from: fromVal, to: toVal,
          data: r.data, stats: r.stats,
          page: r.page, totalPages: r.totalPages, total: r.total,
        });
      }
    } finally { setLoading(false); }
  };

  const exportCSV = () => {
    if (!data.length) return;
    const header = columns.map((c) => c.label).join(",");
    const rows = data.map((d) =>
      columns.map((c) => c.fmt(d[c.key]) ?? "").join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `aqi_${from}_${to}.csv`,
    });
    a.click();
  };

  const chartData = {
    labels: data.map((d) => {
      const t = new Date(d.timestamp);
      // Hiển thị theo giờ VN (UTC+7)
      return t.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
    }),
    datasets: [
      {
        label: "AQI",
        data: data.map((d) => d.aqi),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.07)",
        fill: true, tension: 0.3, borderWidth: 1.8,
        pointRadius: data.length > 100 ? 0 : 2,
        pointBackgroundColor: "#2563eb",
      },
    ],
  };

  const summaryStats = [
    { label: "Tổng bản ghi",    value: total.toLocaleString("vi-VN"),     sub: "điểm đo" },
    { label: "AQI trung bình",  value: stats?.avgAqi?.toFixed(1) ?? "—",  sub: getAQILabel(stats?.avgAqi) },
    { label: "AQI cao nhất",    value: stats?.maxAqi ?? "—",              sub: getAQILabel(stats?.maxAqi) },
    { label: "PM2.5 trung bình",value: stats?.avgPm25?.toFixed(1) ?? "—", sub: "µg/m³" },
  ];

  return (
    <div className="p-5 md:p-8">

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">Lịch sử dữ liệu</h1>
        <p className="text-sm text-gray-400 mt-0.5">Truy vấn và xuất dữ liệu quan trắc theo ngày</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap items-end gap-4">
          {[
            { label: "Từ ngày", value: from, set: setFrom },
            { label: "Đến ngày", value: to, set: setTo },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">{f.label}</label>
              <input
                type="date" value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="px-3.5 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
              />
            </div>
          ))}
          <button
            onClick={() => fetchHistory(1)}
            disabled={loading}
            className="px-5 py-2 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Đang tải..." : "Tìm kiếm"}
          </button>
          <button
            onClick={exportCSV}
            disabled={!data.length}
            className="px-5 py-2 bg-white hover:bg-gray-50 text-gray-600 text-[13px] font-medium rounded-lg border border-gray-200 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Xuất CSV
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {summaryStats.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">{s.label}</p>
              <p className="text-[22px] font-semibold text-gray-900 leading-none">{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-1.5">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {data.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-gray-700">Chỉ số AQI</h3>
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <span className="w-4 h-px bg-blue-600 inline-block" />AQI
            </span>
          </div>
          <div className="h-[220px]">
            <Line data={chartData} options={chartOpts} />
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-left text-[10.5px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-gray-50/60">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center text-[13px] text-gray-300">
                    {searched ? "Không có dữ liệu trong khoảng thời gian này." : "Chọn khoảng thời gian và nhấn Tìm kiếm."}
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-[12.5px] whitespace-nowrap">
                        {c.key === "aqi" ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                            style={{ backgroundColor: getAQIColor(row.aqi) }}
                          >
                            {row.aqi}
                          </span>
                        ) : (
                          <span className={`${c.key === "timestamp" ? "text-gray-500 font-mono text-[11.5px]" : "text-gray-700"}`}>
                            {c.fmt(row[c.key]) ?? "—"}
                            {c.unit && <span className="text-gray-400 ml-0.5 text-[11px]"> {c.unit}</span>}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
            <span className="text-[12px] text-gray-400">
              Trang {page} / {totalPages} · {total.toLocaleString("vi-VN")} bản ghi
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => fetchHistory(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 text-[12px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all cursor-pointer">
                Trước
              </button>
              <button onClick={() => fetchHistory(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 text-[12px] font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all cursor-pointer">
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

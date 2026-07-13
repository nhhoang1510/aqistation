"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon issue in Leaflet + webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function getAQIConfig(aqi) {
  if (aqi == null) return { label: "N/A", color: "#94a3b8", fillColor: "rgba(148,163,184,0.2)" };
  if (aqi <= 50) return { label: "Tốt", color: "#10b981", fillColor: "rgba(16,185,129,0.15)" };
  if (aqi <= 100) return { label: "Trung bình", color: "#eab308", fillColor: "rgba(234,179,8,0.15)" };
  if (aqi <= 150) return { label: "Kém", color: "#f97316", fillColor: "rgba(249,115,22,0.15)" };
  if (aqi <= 200) return { label: "Xấu", color: "#ef4444", fillColor: "rgba(239,68,68,0.15)" };
  if (aqi <= 300) return { label: "Rất xấu", color: "#a855f7", fillColor: "rgba(168,85,247,0.15)" };
  return { label: "Nguy hại", color: "#9f1239", fillColor: "rgba(159,18,57,0.15)" };
}

function createCustomIcon(aqi) {
  const config = getAQIConfig(aqi);
  return L.divIcon({
    className: "custom-aqi-marker",
    html: `
      <div style="
        width: 48px; height: 48px;
        background: ${config.color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 16px ${config.color}66;
        border: 3px solid white;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: 900;
          font-size: 14px;
          font-family: system-ui;
        ">${aqi ?? '--'}</span>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
  });
}

// Vị trí trạm mặc định (Hà Nội)
const STATION_POSITION = [21.0285, 105.8542];
const STATION_NAME = "AQI Station - Nhóm 22 HUST";

export default function MapComponent() {
  const [latestData, setLatestData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/data?limit=1");
        const data = await res.json();
        if (data && data.length > 0) {
          setLatestData(data[data.length - 1]);
        }
      } catch (e) {
        console.error("Map fetch error:", e);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const aqiConfig = getAQIConfig(latestData?.aqi);
  const timestamp = latestData?.timestamp
    ? new Date(latestData.timestamp).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        day: "2-digit", month: "2-digit", year: "numeric",
      })
    : "--";

  return (
    <MapContainer
      center={STATION_POSITION}
      zoom={15}
      style={{ height: "100%", width: "100%", borderRadius: "16px" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* AQI influence radius */}
      <Circle
        center={STATION_POSITION}
        radius={500}
        pathOptions={{
          color: aqiConfig.color,
          fillColor: aqiConfig.fillColor,
          fillOpacity: 0.3,
          weight: 2,
          dashArray: "8 4",
        }}
      />

      {/* Station Marker */}
      <Marker
        position={STATION_POSITION}
        icon={createCustomIcon(latestData?.aqi)}
      >
        <Popup maxWidth={320} className="custom-popup">
          <div style={{ fontFamily: "system-ui, sans-serif", minWidth: "260px" }}>
            {/* Header */}
            <div style={{
              background: `linear-gradient(135deg, ${aqiConfig.color}, ${aqiConfig.color}cc)`,
              margin: "-20px -20px 12px",
              padding: "16px 20px",
              borderRadius: "12px 12px 0 0",
            }}>
              <div style={{ color: "white", fontWeight: 700, fontSize: "14px" }}>🌿 {STATION_NAME}</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px", marginTop: "4px" }}>
                📍 {STATION_POSITION[0].toFixed(4)}, {STATION_POSITION[1].toFixed(4)}
              </div>
            </div>

            {/* AQI Value */}
            <div style={{ textAlign: "center", margin: "8px 0 12px" }}>
              <div style={{ fontSize: "36px", fontWeight: 900, color: aqiConfig.color, lineHeight: 1 }}>
                {latestData?.aqi ?? "--"}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: aqiConfig.color, marginTop: "4px" }}>
                AQI - {aqiConfig.label}
              </div>
            </div>

            {/* Metrics */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "8px", fontSize: "12px",
            }}>
              {[
                { icon: "🌫️", label: "PM2.5", value: `${latestData?.pm2_5 ?? "--"} µg/m³` },
                { icon: "🌫️", label: "PM10", value: `${latestData?.pm10 ?? "--"} µg/m³` },
                { icon: "🌡️", label: "Nhiệt độ", value: `${latestData?.temperature?.toFixed(1) ?? "--"}°C` },
                { icon: "💧", label: "Độ ẩm", value: `${latestData?.humidity?.toFixed(1) ?? "--"}%` },
              ].map((m, i) => (
                <div key={i} style={{
                  background: "#f8fafc", borderRadius: "8px", padding: "8px 10px",
                }}>
                  <div style={{ color: "#94a3b8", fontSize: "10px" }}>{m.icon} {m.label}</div>
                  <div style={{ fontWeight: 700, color: "#334155", marginTop: "2px" }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Timestamp */}
            <div style={{
              textAlign: "center", fontSize: "10px", color: "#94a3b8",
              marginTop: "12px", paddingTop: "8px", borderTop: "1px solid #e2e8f0",
            }}>
              🕐 Cập nhật: {timestamp}
            </div>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}

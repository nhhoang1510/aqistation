"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";

const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
};

function getAQIConfig(aqi) {
  if (aqi == null) return { label: "N/A",       color: "#94a3b8", fill: "rgba(148,163,184,0.15)" };
  if (aqi <= 50)  return { label: "Tốt",        color: "#059669", fill: "rgba(5,150,105,0.12)" };
  if (aqi <= 100) return { label: "Trung bình", color: "#d97706", fill: "rgba(217,119,6,0.12)" };
  if (aqi <= 150) return { label: "Kém",        color: "#ea580c", fill: "rgba(234,88,12,0.12)" };
  if (aqi <= 200) return { label: "Xấu",        color: "#dc2626", fill: "rgba(220,38,38,0.12)" };
  if (aqi <= 300) return { label: "Rất xấu",    color: "#7c3aed", fill: "rgba(124,58,237,0.12)" };
  return           { label: "Nguy hại",          color: "#9f1239", fill: "rgba(159,18,57,0.12)" };
}

// Component pan map to new center
function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

// Default fallback (HUST Hà Nội)
const DEFAULT_POSITION = [21.0045, 105.8412];

export default function MapComponent() {
  const [latestData, setLatestData] = useState(null);
  const [stationPos, setStationPos] = useState(DEFAULT_POSITION);
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | loading | ok | denied
  const [icon, setIcon] = useState(null);

  // Fix Leaflet icons on mount
  useEffect(() => { fixLeafletIcons(); }, []);

  // Get browser geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStationPos([pos.coords.latitude, pos.coords.longitude]);
        setGeoStatus("ok");
      },
      () => {
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Build custom icon (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const aqi = latestData?.aqi;
    const cfg = getAQIConfig(aqi);
    setIcon(L.divIcon({
      className: "",
      html: `
        <div style="
          width:44px;height:44px;
          background:${cfg.color};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 12px ${cfg.color}55;
          border:3px solid white;
        ">
          <span style="
            transform:rotate(45deg);
            color:white;font-weight:700;
            font-size:13px;font-family:'Be Vietnam Pro',system-ui,sans-serif;
            line-height:1;
          ">${aqi ?? "?"}</span>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -50],
    }));
  }, [latestData?.aqi]);

  // Fetch sensor data
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/data?limit=1");
        const data = await res.json();
        if (data?.length > 0) setLatestData(data[data.length - 1]);
      } catch { /* ignore */ }
    };
    run();
    const id = setInterval(run, 10000);
    return () => clearInterval(id);
  }, []);

  const cfg = getAQIConfig(latestData?.aqi);
  const ts = latestData?.timestamp
    ? new Date(latestData.timestamp).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    : "—";

  const popupMetrics = [
    { label: "PM2.5",    value: `${latestData?.pm2_5 ?? "—"} µg/m³` },
    { label: "PM10",     value: `${latestData?.pm10 ?? "—"} µg/m³` },
    { label: "Nhiệt độ", value: `${latestData?.temperature?.toFixed(1) ?? "—"}°C` },
    { label: "Độ ẩm",    value: `${latestData?.humidity?.toFixed(1) ?? "—"}%` },
  ];

  return (
    <div style={{ height: "100%", width: "100%", position: "relative", minHeight: "520px" }}>
      {/* Geolocation status badge */}
      {geoStatus === "loading" && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "white", border: "1px solid #e5e7eb",
          borderRadius: 10, padding: "6px 14px", fontSize: 12, color: "#6b7280",
          display: "flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          <div style={{
            width: 12, height: 12, border: "2px solid #d1d5db",
            borderTopColor: "#374151", borderRadius: "50%", animation: "spin 0.8s linear infinite"
          }} />
          Đang lấy vị trí...
        </div>
      )}
      {geoStatus === "denied" && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "white", border: "1px solid #fde68a",
          borderRadius: 10, padding: "6px 14px", fontSize: 12, color: "#92400e",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          Không lấy được vị trí — hiển thị vị trí mặc định (HUST)
        </div>
      )}

      <MapContainer
        center={stationPos}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <RecenterMap position={stationPos} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Influence radius */}
        <Circle
          center={stationPos}
          radius={300}
          pathOptions={{
            color: cfg.color,
            fillColor: cfg.fill,
            fillOpacity: 1,
            weight: 1.5,
            dashArray: "6 4",
          }}
        />

        {/* Station marker */}
        {icon && (
          <Marker position={stationPos} icon={icon}>
            <Popup maxWidth={260} minWidth={220}>
              <div style={{ fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" }}>
                <div style={{
                  background: cfg.color,
                  margin: "-14px -20px 12px",
                  padding: "14px 16px",
                  borderRadius: "10px 10px 0 0",
                }}>
                  <div style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>
                    AQI Station
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "11px", marginTop: "2px" }}>
                    {stationPos[0].toFixed(5)}, {stationPos[1].toFixed(5)}
                  </div>
                </div>

                <div style={{ textAlign: "center", padding: "4px 0 12px" }}>
                  <div style={{ fontSize: "40px", fontWeight: 800, color: cfg.color, lineHeight: 1 }}>
                    {latestData?.aqi ?? "—"}
                  </div>
                  <div style={{ fontSize: "12px", color: cfg.color, fontWeight: 600, marginTop: "4px" }}>
                    {cfg.label}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                  {popupMetrics.map((m) => (
                    <div key={m.label} style={{ background: "#f8fafc", borderRadius: "8px", padding: "7px 10px" }}>
                      <div style={{ color: "#9ca3af", fontSize: "10px", marginBottom: "2px" }}>{m.label}</div>
                      <div style={{ color: "#1e293b", fontWeight: 600, fontSize: "12px" }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ color: "#9ca3af", fontSize: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                  Cập nhật: {ts}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

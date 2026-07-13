import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function getAQILabel(aqi) {
  if (aqi <= 50)  return "Tốt";
  if (aqi <= 100) return "Trung bình";
  if (aqi <= 150) return "Kém";
  if (aqi <= 200) return "Xấu";
  if (aqi <= 300) return "Rất xấu";
  return "Nguy hại";
}

function getAQIColor(aqi) {
  if (aqi <= 50)  return "#059669";
  if (aqi <= 100) return "#d97706";
  if (aqi <= 150) return "#ea580c";
  if (aqi <= 200) return "#dc2626";
  if (aqi <= 300) return "#7c3aed";
  return "#9f1239";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, phone, aqi, threshold, metrics } = body;

    if (!email && !phone) {
      return NextResponse.json({ error: "Cần cung cấp email hoặc số điện thoại" }, { status: 400 });
    }

    const results = { email: null, phone: null };

    // ── Send email ──
    if (email) {
      const color = getAQIColor(aqi);
      const label = getAQILabel(aqi);
      const html = `
        <!DOCTYPE html>
        <html lang="vi">
        <head><meta charset="UTF-8"><style>
          body { font-family: 'Be Vietnam Pro', 'Segoe UI', sans-serif; background: #f6f7f9; margin: 0; padding: 20px; }
          .card { background: white; border-radius: 16px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: ${color}; padding: 28px 32px; }
          .header h1 { color: white; margin: 0; font-size: 18px; font-weight: 700; }
          .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
          .body { padding: 28px 32px; }
          .aqi-big { font-size: 56px; font-weight: 800; color: ${color}; line-height: 1; }
          .label { display: inline-block; padding: 4px 12px; border-radius: 6px; background: ${color}20; color: ${color}; font-size: 13px; font-weight: 600; margin-top: 6px; }
          .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; }
          .metric { background: #f8fafc; border-radius: 10px; padding: 12px 14px; }
          .metric-label { font-size: 11px; color: #94a3b8; margin-bottom: 3px; }
          .metric-value { font-size: 15px; font-weight: 700; color: #1e293b; }
          .footer { padding: 16px 32px; background: #f8fafc; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style></head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Cảnh báo chất lượng không khí</h1>
              <p>AQI Station — ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
            </div>
            <div class="body">
              <p style="color:#475569;font-size:14px;margin:0 0 16px">Chỉ số AQI vượt ngưỡng cảnh báo <strong>${threshold}</strong>:</p>
              <div class="aqi-big">${aqi}</div>
              <div class="label">${label}</div>
              <div class="metrics">
                <div class="metric"><div class="metric-label">PM2.5</div><div class="metric-value">${metrics?.pm2_5 ?? "—"} µg/m³</div></div>
                <div class="metric"><div class="metric-label">PM10</div><div class="metric-value">${metrics?.pm10 ?? "—"} µg/m³</div></div>
                <div class="metric"><div class="metric-label">Nhiệt độ</div><div class="metric-value">${metrics?.temperature?.toFixed(1) ?? "—"}°C</div></div>
                <div class="metric"><div class="metric-label">Độ ẩm</div><div class="metric-value">${metrics?.humidity?.toFixed(1) ?? "—"}%</div></div>
              </div>
            </div>
            <div class="footer">Được gửi tự động bởi AQI Station Dashboard · Nhóm 22 HUST</div>
          </div>
        </body></html>
      `;

      await transporter.sendMail({
        from: `"AQI Station" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Cảnh báo AQI: ${aqi} — ${label}`,
        html,
      });
      results.email = "sent";
    }

    // ── Send SMS via phone ──
    // Hiện tại: log SĐT, cần tích hợp Twilio/ESMS để gửi thực
    if (phone) {
      // TODO: Tích hợp SMS provider (Twilio, ESMS.vn...)
      console.log(`[ALERT] SMS to ${phone}: AQI=${aqi} (${getAQILabel(aqi)}) — threshold=${threshold}`);
      // Ví dụ Twilio:
      // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
      // await twilio.messages.create({ to: phone, from: process.env.TWILIO_FROM, body: `Cảnh báo AQI: ${aqi} (${getAQILabel(aqi)}). Ngưỡng: ${threshold}. PM2.5: ${metrics?.pm2_5} µg/m³` });
      results.phone = "logged"; // đổi thành "sent" khi có SMS provider
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Alert send error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

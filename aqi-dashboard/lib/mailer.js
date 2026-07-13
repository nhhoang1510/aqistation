import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function getAQILevel(aqi) {
  if (aqi <= 50) return { label: 'Tốt', color: '#10b981', emoji: '😊' };
  if (aqi <= 100) return { label: 'Trung bình', color: '#eab308', emoji: '😐' };
  if (aqi <= 150) return { label: 'Kém', color: '#f97316', emoji: '😷' };
  if (aqi <= 200) return { label: 'Xấu', color: '#ef4444', emoji: '🤢' };
  if (aqi <= 300) return { label: 'Rất xấu', color: '#a855f7', emoji: '🤮' };
  return { label: 'Nguy hại', color: '#9f1239', emoji: '☠️' };
}

export async function sendAlertEmail(toEmail, userName, aqiData) {
  const level = getAQILevel(aqiData.aqi);
  const timestamp = new Date(aqiData.timestamp).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,${level.color},${level.color}dd);padding:32px 24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">${level.emoji}</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">⚠️ Cảnh Báo Chất Lượng Không Khí</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">AQI Station Alert System</p>
      </div>

      <!-- Body -->
      <div style="padding:24px;">
        <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
          Xin chào <strong>${userName}</strong>,
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
          Chỉ số chất lượng không khí (AQI) tại trạm quan trắc đã vượt ngưỡng cảnh báo của bạn:
        </p>

        <!-- AQI Value -->
        <div style="text-align:center;background:#f8fafc;border-radius:12px;padding:20px;margin:0 0 20px;">
          <div style="font-size:56px;font-weight:900;color:${level.color};line-height:1;">${aqiData.aqi}</div>
          <div style="font-size:16px;font-weight:600;color:${level.color};margin-top:4px;">${level.label}</div>
        </div>

        <!-- Metrics Table -->
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 20px;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 8px;color:#64748b;">🌫️ PM2.5</td>
            <td style="padding:10px 8px;text-align:right;font-weight:600;color:#334155;">${aqiData.pm2_5} µg/m³</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 8px;color:#64748b;">🌫️ PM10</td>
            <td style="padding:10px 8px;text-align:right;font-weight:600;color:#334155;">${aqiData.pm10} µg/m³</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 8px;color:#64748b;">🌡️ Nhiệt độ</td>
            <td style="padding:10px 8px;text-align:right;font-weight:600;color:#334155;">${aqiData.temperature?.toFixed(1)}°C</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 8px;color:#64748b;">💧 Độ ẩm</td>
            <td style="padding:10px 8px;text-align:right;font-weight:600;color:#334155;">${aqiData.humidity?.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="padding:10px 8px;color:#64748b;">🕐 Thời gian</td>
            <td style="padding:10px 8px;text-align:right;font-weight:600;color:#334155;">${timestamp}</td>
          </tr>
        </table>

        <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0;line-height:1.5;">
          Email tự động từ AQI Station. Bạn có thể thay đổi cài đặt cảnh báo trong trang Settings của Dashboard.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: `"AQI Station 🌿" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `⚠️ Cảnh báo AQI = ${aqiData.aqi} (${level.label}) - AQI Station`,
    html: htmlContent,
  };

  return transporter.sendMail(mailOptions);
}

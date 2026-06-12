# AQI Station

A real-time Air Quality Index monitoring system built with ESP32, FreeRTOS, and a Next.js web dashboard.

## Architecture

```
ESP32 (Sensors) → MQTT Broker → Local Server (Node.js) → MongoDB Atlas → Dashboard (Next.js)
```

## Hardware

| Component | Purpose |
|-----------|---------|
| ESP32 DevKit | Main microcontroller running FreeRTOS |
| PMS5003 | Particulate matter sensor (PM2.5, PM10) |
| BME680 | Temperature, humidity, pressure, gas resistance |
| MQ135 | Air quality / gas detection (analog) |
| SD Card Module | Local CSV data logging |

## Software

### ESP32 Firmware (`esp32_air_quality/`)

FreeRTOS multi-task architecture across dual cores:

| Task | Core | Priority | Function |
|------|------|----------|----------|
| taskPMS | 1 | 3 | Read PMS5003 via UART with frame sync and checksum verification |
| taskSensors | 1 | 2 | Read BME680 + MQ135 every 10s, compute AQI |
| taskSDCard | 1 | 1 | Log data to SD card as CSV |
| taskNetwork | 0 | 1 | WiFi + MQTT publish to broker |

Key features:
- Mutex-protected shared data between tasks
- EventGroup-based task notification (zero-overhead signaling)
- Task Watchdog Timer (30s) for automatic recovery
- Digital filters: Moving Average (PM), EMA (BME680), Median (MQ135)
- AQI calculation using EPA Breakpoint Interpolation

### Local Server (`local_server/`)

Node.js MQTT subscriber that:
- Listens to `aqistation/data` topic on `broker.emqx.io`
- Saves sensor data to MongoDB Atlas
- Logs data locally to `database.csv`

### Web Dashboard (`aqi-dashboard/`)

Next.js real-time dashboard with:
- Live AQI display with color-coded scale
- Temperature, humidity, pressure, gas resistance widgets
- Historical charts (Chart.js) with selectable time ranges
- Auto-refresh every 5 seconds

## Quick Start

1. **Flash ESP32** firmware using Arduino IDE
2. **Start local server:**
   ```bash
   cd local_server
   npm install
   node server.js
   ```
3. **Start dashboard:**
   ```bash
   cd aqi-dashboard
   npm install
   npm run dev
   ```

## Environment Variables

Create `.env` in both `local_server/` and `aqi-dashboard/`:

```
MONGODB_URI=mongodb://...
```

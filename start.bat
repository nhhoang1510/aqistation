@echo off
title AQI Station - Khoi dong he thong
color 0A

echo.
echo  ============================================
echo   AQI STATION - KHOI DONG HE THONG
echo  ============================================
echo.

:: Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js. Vui long cai dat Node.js truoc!
    pause
    exit /b 1
)

echo [1/2] Khoi dong Local Server (MQTT + Database)...
start "AQI - Local Server" cmd /k "cd /d "%~dp0local_server" && node server.js"

:: Cho server khoi dong xong
timeout /t 3 /nobreak >nul

echo [2/2] Khoi dong AQI Dashboard (Next.js)...
start "AQI - Dashboard" cmd /k "cd /d "%~dp0aqi-dashboard" && npm run dev"

echo.
echo  ============================================
echo   He thong da khoi dong thanh cung!
echo.
echo   Local Server : http://localhost:5000
echo   Dashboard    : http://localhost:3001
echo   (Grafana chiem port 3000, AQI dung port 3001)
echo  ============================================
echo.
echo  (Dong cua so nay khong anh huong den server)
echo.

:: Tu dong mo Dashboard tren trinh duyet
start https://aqistation.vercel.app

exit

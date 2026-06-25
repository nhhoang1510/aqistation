@echo off
title AQI Station - Dung he thong
color 0C

echo.
echo  ============================================
echo   AQI STATION - DUNG HE THONG
echo  ============================================
echo.

echo Dang dung Local Server va Dashboard...

:: Tat cac cua so cmd co ten AQI
taskkill /FI "WINDOWTITLE eq AQI - Local Server*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq AQI - Dashboard*" /F >nul 2>nul

:: Tat Node.js processes (neu can)
taskkill /IM node.exe /F >nul 2>nul

echo.
echo  He thong da dung hoan toan!
echo.
timeout /t 2 /nobreak >nul
exit

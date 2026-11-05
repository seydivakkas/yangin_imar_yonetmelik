@echo off
chcp 65001 >nul
title DiagramYonetmelik Durdurucu

echo ======================================================================
echo    DiagramYonetmelik Servisleri Kapatiliyor...
echo ======================================================================
echo.

:: 8790 ve 5173 portlarını dinleyen süreçleri bul ve sonlandır
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8790 ^| findstr LISTENING') do (
    echo Backend - Port 8790, PID: %%a kapatiliyor...
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Frontend - Port 5173, PID: %%a kapatiliyor...
    taskkill /F /PID %%a >nul 2>&1
)

:: Başlık ile açılmış cmd pencerelerini de temizle
taskkill /fi "WINDOWTITLE eq DiagramYonetmelik - Backend*" /f /t >nul 2>&1
taskkill /fi "WINDOWTITLE eq DiagramYonetmelik - Frontend*" /f /t >nul 2>&1
taskkill /fi "WINDOWTITLE eq DiagramYonetmelik - Platform*" /f /t >nul 2>&1

echo.
echo Tum servisler basariyla durduruldu.
timeout /t 2 >nul
exit

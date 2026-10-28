@echo off
chcp 65001 >nul
title DiagramYonetmelik Baslatici

echo ======================================================================
echo    DiagramYonetmelik - Nöro-Sembolik 3B Yangin & Imar Mevzuat Denetimi
echo ======================================================================
echo.
echo [1/3] Backend (FastAPI - Port 8790) baslatiliyor...
cd /d "%~dp0"
start "DiagramYonetmelik - Backend (FastAPI)" cmd /k "chcp 65001 >nul && python -m uvicorn diagram_yonetmelik.api:app --host 127.0.0.1 --port 8790"

echo [2/3] Frontend (Vite React - Port 5173) baslatiliyor...
cd /d "%~dp0frontend"
start "DiagramYonetmelik - Frontend (Vite)" cmd /k "chcp 65001 >nul && npm run dev"

echo [3/3] Servislerin hazirlanmasi bekleniyor (3 sn)...
timeout /t 3 /nobreak >nul

echo Tarayici aciliyor: http://localhost:5173
start http://localhost:5173

echo.
echo ======================================================================
echo    Sistem basariyla calistirildi!
echo    - Frontend  : http://localhost:5173
echo    - Backend   : http://127.0.0.1:8790
echo    - API Docs  : http://127.0.0.1:8790/docs
echo ======================================================================
echo Bu pencereyi kapatabilirsiniz. Servisler arka plan pencerelerinde calisacaktir.
timeout /t 5 >nul
exit

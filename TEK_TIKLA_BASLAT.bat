@echo off
chcp 65001 >nul
title DiagramYonetmelik - Tek Tikla Baslatici & Kurucu

echo ======================================================================
echo    DiagramYonetmelik - 3B Yangin ve Imar Mevzuat Denetim Platformu
echo                  TEK TIKLA BASLATICI VE KURUCU
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. Python kontrolü
echo [1/3] Python ortami denetleniyor...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    py --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo [HATA] Bilgisayarinizda Python kurulu bulunamadi!
        echo.
        echo Lutfen asagidaki resmi adresten Python'i indirip kurunuz:
        echo https://www.python.org/downloads/
        echo.
        echo ONEMLI: Kurulum penceresinin altindaki "Add python.exe to PATH"
        echo kutucugunu MUTLAKA ISARETLEYINIZ!
        echo.
        pause
        exit /b 1
    )
)
echo       Python hazir.

:: 2. Python Kütüphaneleri Kontrolü ve Otomatik Kurulum
echo.
echo [2/3] Gerekli Python kutuphaneleri denetleniyor...
python -c "import fastapi, uvicorn, ezdxf, networkx, shapely, cv2, pydantic" >nul 2>&1
if %errorlevel% neq 0 (
    echo       Bazi paketler eksik. requirements.txt uzerinden otomatik kuruluyor...
    echo       (Bu islem yalnizca ilk calistirmada gerceklesir, lutfen bekleyiniz...)
    echo.
    python -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo.
        echo [UYARI] Otomatik kurulum sirasinda bir uyari olustu.
        echo Sistem yine de baslatilmaya calisiliyor...
    )
) else (
    echo       Tum Python paketleri tam ve hazir.
)

:: 3. Çalışma Modu Seçimi (Pre-built Web vs Vite Dev)
echo.
echo [3/3] Uygulama servisleri baslatiliyor...
set MODE=STANDALONE
where npm >nul 2>&1
if %errorlevel% equ 0 (
    if exist "%~dp0frontend\node_modules" (
        set MODE=DEV
    )
)

if "%MODE%"=="DEV" (
    echo       Gelistirici Modu: Backend (8790) + Vite Frontend (5173)
    start "DiagramYonetmelik - Backend (FastAPI)" cmd /k "chcp 65001 >nul && python -m uvicorn diagram_yonetmelik.api:app --host 127.0.0.1 --port 8790"
    cd /d "%~dp0frontend"
    start "DiagramYonetmelik - Frontend (Vite)" cmd /k "chcp 65001 >nul && npm run dev"
    cd /d "%~dp0"
    timeout /t 3 /nobreak >nul
    echo       Tarayici aciliyor: http://localhost:5173
    start http://localhost:5173
) else (
    echo       Hizli Calisma Modu: Entegre 3B Arayuz ve Backend (Port 8790)
    echo       (Node.js gerektirmez, derlenmis 3B React arayuzu FastAPI uzerinden acilir)
    start "DiagramYonetmelik - Platform" cmd /k "chcp 65001 >nul && python -m uvicorn diagram_yonetmelik.api:app --host 127.0.0.1 --port 8790"
    timeout /t 3 /nobreak >nul
    echo       Tarayici aciliyor: http://localhost:8790
    start http://localhost:8790
)

echo.
echo ======================================================================
echo    DiagramYonetmelik Basariyla Calistirildi!
echo    - Tarayicinizda acilmadiysa adresi kopyalayabilirsiniz:
echo      http://localhost:8790  (veya Gelistirici modunda http://localhost:5173)
echo.
echo    - Ornek test paftalari klasor icinde mevcuttur (.dxf)
echo    - Sistemi kapatmak istediginizde "durdur.bat" dosyasina tiklayiniz.
echo ======================================================================
timeout /t 5 >nul
exit

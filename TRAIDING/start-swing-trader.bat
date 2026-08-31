@echo off
title Swing Trader Server
cd /d "C:\CLAUDE AI\TRAIDING\swing-trader"
echo.
echo ========================================
echo   Swing Trader - Starting Server...
echo ========================================
echo.
echo Server: http://localhost:3000
echo Browser will open automatically in 8 seconds...
echo.

REM Open browser after 8 seconds (in background)
start /min cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:3000"

REM Start the server
npm run dev
pause

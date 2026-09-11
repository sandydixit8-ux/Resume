@echo off
rem Start all 5 project servers - double-click this file.
rem Node servers need their own console window or Next.js exits immediately.
setlocal

start "ResumeIQ-Frontend" /min cmd /c "cd /d C:\Users\Ats\OneDrive\Documents\ResumeIQ\frontend && npm run dev >> C:\Users\Ats\dev-servers\fe3000.log 2>&1"
start "ResumeIQ-Backend" /min cmd /c "cd /d C:\Users\Ats\OneDrive\Documents\ResumeIQ\backend && C:\Users\Ats\AppData\Local\Python\bin\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >> C:\Users\Ats\dev-servers\be8000.log 2>&1"
start "CRM" /min cmd /c "cd /d C:\Users\Ats\OneDrive\Documents\Default Project\crm && npm run dev -- --port 4000 >> C:\Users\Ats\dev-servers\crm4000.log 2>&1"
start "CommandCenter" /min cmd /c "cd /d C:\Users\Ats\OneDrive\Documents\Sandeep-AI-Command-Center && C:\Users\Ats\AppData\Local\Python\bin\python.exe -m uvicorn webapi.app:app --host 127.0.0.1 --port 5000 >> C:\Users\Ats\dev-servers\cc5000.log 2>&1"
start "TradingAgent" /min cmd /c "cd /d C:\TradingAgent && .venv\Scripts\python.exe monitor_web.py --port 8600 >> C:\Users\Ats\dev-servers\ta8600.log 2>&1"

echo Servers launching in minimized windows...
echo   ResumeIQ frontend   http://localhost:3000
echo   ResumeIQ backend    http://127.0.0.1:8000
echo   CRM                 http://localhost:4000
echo   Command Center      http://127.0.0.1:5000
echo   TradingAgent        http://127.0.0.1:8600
echo.
echo Logs: C:\Users\Ats\dev-servers\
echo Wait a few seconds, then open the URLs above in your browser.
@echo off
cd /d "%~dp0"
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://127.0.0.1:8000/"
"C:\Users\Ats\AppData\Local\Python\bin\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

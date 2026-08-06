@echo off
cd /d "C:\Users\Ats\OneDrive\Documents\Default Project\backend"
"C:\Users\Ats\AppData\Local\Python\bin\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 >> "C:\Users\Ats\AppData\Local\Temp\opencode\be_server.log" 2>&1

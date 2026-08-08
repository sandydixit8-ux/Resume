# start-dev.ps1 - One-command dev launcher for ResumeIQ.
#
# Why this exists: other projects on this machine (e.g. dpiic-backend) also
# bind port 8000. Instead of fighting over the port, this launcher picks the
# first free port starting at 8000 and wires the frontend to it automatically,
# so ResumeIQ always comes up even when another app holds 8000.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File start-dev.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$python = "C:\Users\Ats\AppData\Local\Python\bin\python.exe"

if (-not (Test-Path $python)) { Write-Host "ERROR: python not found at $python" -ForegroundColor Red; exit 1 }
if (-not (Test-Path (Join-Path $backendDir "app\main.py"))) { Write-Host "ERROR: backend app not found under $backendDir" -ForegroundColor Red; exit 1 }

function Test-PortFree([int]$Port) {
  return -not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# 1) Pick a backend port
$backendPort = 8000
for ($p = 8000; $p -lt 8010; $p++) {
  if (Test-PortFree $p) { $backendPort = $p; break }
}
if (-not (Test-PortFree $backendPort)) {
  Write-Host "ERROR: no free port in 8000-8009." -ForegroundColor Red
  exit 1
}

# 2) Start backend in its own window
Write-Host "Starting backend on http://localhost:$backendPort ..."
$beOut = Join-Path $backendDir "server_out.log"
$beErr = Join-Path $backendDir "server_error.log"
Start-Process -FilePath $python `
  -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$backendPort") `
  -WorkingDirectory $backendDir `
  -RedirectStandardOutput $beOut `
  -RedirectStandardError $beErr `
  -WindowStyle Hidden

# 3) Wait for the backend to accept connections (fast TCP probe), then verify it is the real ResumeIQ app
Write-Host "Waiting for backend..."
$deadline = (Get-Date).AddSeconds(120)
$connected = $false
while ((Get-Date) -lt $deadline) {
  $tcp = New-Object System.Net.Sockets.TcpClient
  try {
    $ar = $tcp.BeginConnect("127.0.0.1", $backendPort, $null, $null)
    if ($ar.AsyncWaitHandle.WaitOne(2000)) {
      $tcp.EndConnect($ar)
      $connected = $true
    }
  } catch {}
  $tcp.Close()
  if ($connected) { break }
  Start-Sleep -Milliseconds 500
}
if (-not $connected) {
  Write-Host "ERROR: backend did not start on port $backendPort. Check $backendDir\server_out.log" -ForegroundColor Red
  exit 1
}
$o = Invoke-RestMethod "http://localhost:$backendPort/openapi.json" -TimeoutSec 15
if ($o.info.title -notmatch "ResumeIQ") {
  Write-Host "ERROR: something else answered on port ${backendPort}: '$($o.info.title)'. Refusing to proceed." -ForegroundColor Red
  exit 1
}
Write-Host "Backend up: $($o.info.title)"

# 4) Start frontend on 3000, pointed at the chosen backend port
if (Test-PortFree 3000) {
  Write-Host "Starting frontend on http://localhost:3000 (backend $backendPort)..."
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/c", "set `"BACKEND_INTERNAL_URL=http://localhost:$backendPort`" && npm.cmd run dev > dev_out.log 2>&1") `
    -WorkingDirectory $frontendDir `
    -WindowStyle Hidden
} else {
  Write-Host "WARNING: port 3000 is already in use. If it is an old ResumeIQ frontend, restart it:" -ForegroundColor Yellow
  Write-Host "  set BACKEND_INTERNAL_URL=http://localhost:$backendPort && npm run dev (in $frontendDir)"
}

Write-Host ""
Write-Host "ResumeIQ ready:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000"
Write-Host "  Backend : http://localhost:$backendPort  (docs: /docs)"
Write-Host "  Admin   : http://localhost:3000/admin/login  (admin / admin123)"

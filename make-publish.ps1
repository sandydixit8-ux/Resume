# ResumeIQ AI - build the single publish folder.
# Run:  powershell -ExecutionPolicy Bypass -File make-publish.ps1
# Output:  .\publish\  (a self-contained folder ready to upload to a VPS)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$pub  = Join-Path $root "publish"

if (Test-Path $pub) { Remove-Item -Recurse -Force $pub }
New-Item -ItemType Directory -Path $pub | Out-Null

function Copy-Required {
  param([string]$src, [string]$dest)
  if (Test-Path $src) {
    $parent = Split-Path $dest -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -Recurse -Force $src $dest
  }
}

Write-Host "Assembling publish folder..."

# --- Backend (app code + deps manifest) ---
Copy-Required (Join-Path $root "backend\app")              (Join-Path $pub "backend\app")
Copy-Required (Join-Path $root "backend\requirements.txt") (Join-Path $pub "backend\requirements.txt")
Copy-Required (Join-Path $root "backend\run.py")           (Join-Path $pub "backend\run.py")

# --- Frontend (source required to build on the server) ---
Copy-Required (Join-Path $root "frontend\src")               (Join-Path $pub "frontend\src")
Copy-Required (Join-Path $root "frontend\public")            (Join-Path $pub "frontend\public")
foreach ($f in @("package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "next-env.d.ts", "postcss.config.mjs", "eslint.config.mjs")) {
  Copy-Required (Join-Path $root "frontend\$f") (Join-Path $pub "frontend\$f")
}

# --- Deploy configs (Caddyfile, systemd, env template, Docker) ---
$deployFiles = Get-ChildItem (Join-Path $root "deploy") -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -ne ".log" }
foreach ($f in $deployFiles) {
  Copy-Required $f.FullName (Join-Path $pub "deploy\$($f.Name)")
}

# --- Root helpers ---
Copy-Required (Join-Path $root ".dockerignore") (Join-Path $pub ".dockerignore")
Copy-Required (Join-Path $pub "deploy\setup-from-publish.sh") (Join-Path $pub "setup.sh")

# --- Cleanup: drop compiled artifacts ---
Get-ChildItem $pub -Recurse -Directory -Filter "__pycache__" | ForEach-Object { Remove-Item -Recurse -Force $_.FullName }
Get-ChildItem $pub -Recurse -Filter "*.pyc" | Remove-Item -Force

Write-Host ""
Write-Host "Publish folder created at: $pub"
Write-Host "Contents:"
Get-ChildItem $pub -Recurse -Directory | ForEach-Object { Write-Host ("  " + $_.FullName.Substring($root.Length)) }

# ResumeIQ AI - assemble a single self-contained "ResumeIQ" folder with
# ALL files related to the website (source, deploy configs, docs, tests).
# Generated junk is excluded (node_modules, .next, .git, db files, logs, caches).
#
# Run:  powershell -ExecutionPolicy Bypass -File make-resumeiq-folder.ps1 [-Dest "C:\path"]
# Default output:  ..\ResumeIQ   (i.e. next to this project in Documents)

param(
  [string]$Dest = ""
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

if (-not $Dest) {
  $Dest = Join-Path (Split-Path $root -Parent) "ResumeIQ"
}

if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Path $Dest | Out-Null

function Copy-Required {
  param([string]$src, [string]$dest)
  if (Test-Path $src) {
    $parent = Split-Path $dest -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -Recurse -Force $src $dest
  }
}

Write-Host "Assembling ResumeIQ folder at: $Dest"

# --- Root files ---
foreach ($f in @(".gitignore", ".dockerignore", "render.yaml", "netlify.toml",
                 "QA_Audit_Report.md", "ResumeIQ_Resume_Optimization_Package.md",
                 "make-publish.ps1", "make-resumeiq-folder.ps1")) {
  Copy-Required (Join-Path $root $f) (Join-Path $Dest $f)
}

# --- Backend (app + tests + helpers) ---
Copy-Required (Join-Path $root "backend\app")              (Join-Path $Dest "backend\app")
Copy-Required (Join-Path $root "backend\tests")            (Join-Path $Dest "backend\tests")
Copy-Required (Join-Path $root "backend\requirements.txt") (Join-Path $Dest "backend\requirements.txt")
Copy-Required (Join-Path $root "backend\run.py")           (Join-Path $Dest "backend\run.py")
Copy-Required (Join-Path $root "backend\run_server.cmd")   (Join-Path $Dest "backend\run_server.cmd")

# --- Frontend (source + configs + docs + helper) ---
Copy-Required (Join-Path $root "frontend\src")              (Join-Path $Dest "frontend\src")
Copy-Required (Join-Path $root "frontend\public")           (Join-Path $Dest "frontend\public")
Copy-Required (Join-Path $root "frontend\README.md")        (Join-Path $Dest "frontend\README.md")
Copy-Required (Join-Path $root "frontend\run_dev.cmd")      (Join-Path $Dest "frontend\run_dev.cmd")
Copy-Required (Join-Path $root "frontend\.gitignore")       (Join-Path $Dest "frontend\.gitignore")
foreach ($f in @("package.json", "package-lock.json", "next.config.ts", "tsconfig.json",
                 "next-env.d.ts", "postcss.config.mjs", "eslint.config.mjs")) {
  Copy-Required (Join-Path $root "frontend\$f") (Join-Path $Dest "frontend\$f")
}

# --- Deploy configs (all non-log files) ---
$deployFiles = Get-ChildItem (Join-Path $root "deploy") -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -ne ".log" }
foreach ($f in $deployFiles) {
  Copy-Required $f.FullName (Join-Path $Dest "deploy\$($f.Name)")
}

# --- Cleanup: drop compiled/cached artifacts ---
Get-ChildItem $Dest -Recurse -Directory -Filter "__pycache__" | ForEach-Object { Remove-Item -Recurse -Force $_.FullName }
Get-ChildItem $Dest -Recurse -Filter "*.pyc" | Remove-Item -Force
Get-ChildItem $Dest -Recurse -Filter "*.log" | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Contents:"
Get-ChildItem $Dest | Select-Object Name, @{N="Type";E={if($_.PSIsContainer){"folder"}else{"file"}}} | Format-Table -AutoSize | Out-String | Write-Host

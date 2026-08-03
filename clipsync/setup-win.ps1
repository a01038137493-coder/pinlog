# 핀로그 클립싱크 — Windows 원클릭 설치 (Node 불필요)
# 사용(PowerShell): irm https://www.pinlog.kr/clipsync/setup-win.ps1 | iex
$ErrorActionPreference = "Stop"
Write-Host "[Pinlog ClipSync] Installing..."

$dir = Join-Path $HOME "pinlog-clipsync"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# 이미 돌고 있는 구버전 에이전트 종료 (재설치/업데이트 시 중복 실행 방지)
schtasks /End /TN "PinlogClipSync" 2>$null | Out-Null
try {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -match "clipsync\.ps1" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch { }

Invoke-WebRequest "https://www.pinlog.kr/clipsync/clipsync.ps1" -OutFile (Join-Path $dir "clipsync.ps1")

$email = $env:PINLOG_EMAIL
if (-not $email) { $email = Read-Host "Pinlog email" }
$pw = $env:PINLOG_PW
if (-not $pw) { $pw = Read-Host "Connect password (create it on the Pinlog clipboard page)" }

@{ email = $email; password = $pw; twoWay = $true } | ConvertTo-Json |
  Set-Content -Path (Join-Path $HOME ".pinlog-clipsync.json") -Encoding UTF8

$script = Join-Path $dir "clipsync.ps1"
schtasks /Create /F /SC ONLOGON /TN "PinlogClipSync" `
  /TR "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" | Out-Null
schtasks /Run /TN "PinlogClipSync" | Out-Null

Write-Host "[OK] Installed! Just press Ctrl+C - it syncs to your other devices automatically."
Write-Host "  Uninstall: schtasks /Delete /TN PinlogClipSync /F"

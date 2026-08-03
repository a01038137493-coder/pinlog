# 핀로그 클립싱크 — Windows 원클릭 설치 (Node 불필요)
# 사용(PowerShell): irm https://www.pinlog.kr/clipsync/setup-win.ps1 | iex
$ErrorActionPreference = "Stop"
Write-Host "📌 핀로그 클립싱크 설치를 시작합니다"

$dir = Join-Path $HOME "pinlog-clipsync"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest "https://www.pinlog.kr/clipsync/clipsync.ps1" -OutFile (Join-Path $dir "clipsync.ps1")

$email = $env:PINLOG_EMAIL
if (-not $email) { $email = Read-Host "핀로그 이메일" }
$pw = $env:PINLOG_PW
if (-not $pw) { $pw = Read-Host "연결 암호 (핀로그 클립보드 페이지에서 생성)" }

@{ email = $email; password = $pw; twoWay = $true } | ConvertTo-Json |
  Set-Content -Path (Join-Path $HOME ".pinlog-clipsync.json") -Encoding UTF8

$script = Join-Path $dir "clipsync.ps1"
schtasks /Create /F /SC ONLOGON /TN "PinlogClipSync" `
  /TR "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" | Out-Null
schtasks /Run /TN "PinlogClipSync" | Out-Null

Write-Host "✅ 설치 완료! 이제 복사(Ctrl+C)만 하면 다른 기기와 자동 동기화됩니다."
Write-Host "   해제: schtasks /Delete /TN PinlogClipSync /F"

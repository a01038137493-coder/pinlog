# 핀로그 클립싱크 에이전트 — Windows PowerShell 단독 버전 (Node 불필요)
# ------------------------------------------------------------
# 설정: $HOME\.pinlog-clipsync.json  { "email": "...", "password": "...", "twoWay": true }
# 실행: powershell -ExecutionPolicy Bypass -File clipsync.ps1
# 상시 실행 등록은 install-win.bat 참고
# ------------------------------------------------------------
$ErrorActionPreference = "SilentlyContinue"
$URL = "https://dklpbpldgnwckyfgikdt.supabase.co"
$KEY = "sb_publishable_TUVifI_U6Ht2PFN6BfOGEw_RDKjmUEE"
$CFG = Join-Path $HOME ".pinlog-clipsync.json"
$DEVICE = "Windows"

if (!(Test-Path $CFG)) {
  Write-Host "Config file required: $CFG"
  Write-Host 'Example: { "email": "you@example.com", "password": "****", "twoWay": true }'
  exit 1
}
$cfg = Get-Content $CFG -Raw | ConvertFrom-Json
$twoWay = if ($null -eq $cfg.twoWay) { $true } else { [bool]$cfg.twoWay }

function Login {
  $body = @{ email = $cfg.email; password = $cfg.password } | ConvertTo-Json
  $r = Invoke-RestMethod -Method Post -Uri "$URL/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $KEY } -ContentType "application/json" -Body $body
  if (-not $r.access_token) { Write-Host "Login failed"; exit 1 }
  $script:token = $r.access_token
  $script:uid = $r.user.id
  Write-Host "Logged in: $($cfg.email) (Windows)"
}
Login

$lastLocal = Get-Clipboard -Raw
$lastRemoteAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Write-Host "Watching clipboard (two-way: $twoWay)"

while ($true) {
  Start-Sleep -Milliseconds 1200

  # 1) 로컬 변경 → 업로드
  $text = Get-Clipboard -Raw
  if ($text -and $text.Trim() -ne "" -and $text -ne $lastLocal) {
    $lastLocal = $text
    if ($text.Length -gt 10000) { $text = $text.Substring(0, 10000) }
    $body = @{ user_id = $uid; content = $text; device = $DEVICE } | ConvertTo-Json
    try {
      $res = Invoke-RestMethod -Method Post -Uri "$URL/rest/v1/clips" `
        -Headers @{ apikey = $KEY; Authorization = "Bearer $token"; Prefer = "return=representation" } `
        -ContentType "application/json" -Body $body
      if ($res) { $lastRemoteAt = $res[0].created_at }
      Write-Host "Uploaded: $($text.Substring(0, [Math]::Min(40, $text.Length)))"
    } catch {
      Login   # 토큰 만료 등 → 재로그인 후 다음 루프에서 재시도
      $lastLocal = $null
    }
  }

  # 2) 다른 기기의 새 클립 → 이 기기 클립보드로
  if ($twoWay) {
    try {
      $enc = [uri]::EscapeDataString($lastRemoteAt)
      $rows = Invoke-RestMethod -Method Get `
        -Uri "$URL/rest/v1/clips?select=content,device,created_at&user_id=eq.$uid&created_at=gt.$enc&device=neq.$DEVICE&order=created_at.desc&limit=1" `
        -Headers @{ apikey = $KEY; Authorization = "Bearer $token" }
      if ($rows -and $rows.Count -gt 0) {
        $row = $rows[0]
        $lastRemoteAt = $row.created_at
        $lastLocal = $row.content
        Set-Clipboard -Value $row.content
        Write-Host "Received -> clipboard: $($row.device) - $($row.content.Substring(0, [Math]::Min(40, $row.content.Length)))"
      }
    } catch { }
  }
}

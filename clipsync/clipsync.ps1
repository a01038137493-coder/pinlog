# 핀로그 클립싱크 에이전트 — Windows PowerShell 단독 버전 (Node 불필요)
# ------------------------------------------------------------
# 텍스트·이미지 클립보드를 감시해 핀로그 계정으로 양방향 동기화한다.
# 설정: $HOME\.pinlog-clipsync.json
#   { "email": "...", "password": "...", "twoWay": true, "notify": true }
# ------------------------------------------------------------
$ErrorActionPreference = "SilentlyContinue"
$URL = "https://dklpbpldgnwckyfgikdt.supabase.co"
$KEY = "sb_publishable_TUVifI_U6Ht2PFN6BfOGEw_RDKjmUEE"
$CFG = Join-Path $HOME ".pinlog-clipsync.json"
$DEVICE = "Windows"
$MAXIMG = 8MB

if (!(Test-Path $CFG)) {
  Write-Host "Config file required: $CFG"
  Write-Host 'Example: { "email": "you@example.com", "password": "****", "twoWay": true }'
  exit 1
}
$cfg = Get-Content $CFG -Raw | ConvertFrom-Json
$twoWay = if ($null -eq $cfg.twoWay) { $true } else { [bool]$cfg.twoWay }
$notifyOn = if ($null -eq $cfg.notify) { $true } else { [bool]$cfg.notify }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 동기화 확인 알림 (트레이 풍선)
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Information
$tray.Visible = $true
$tray.Text = "Pinlog ClipSync"
function Show-Note($msg) {
  if (-not $notifyOn) { return }
  try {
    $tray.BalloonTipTitle = "핀로그 클립보드"
    $tray.BalloonTipText = $msg
    $tray.ShowBalloonTip(1500)
  } catch { }
}

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

$sha1 = [System.Security.Cryptography.SHA1]::Create()
function Get-Hash([byte[]]$bytes) { [BitConverter]::ToString($sha1.ComputeHash($bytes)) -replace "-", "" }

function Get-ClipImageBytes {
  if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) { return $null }
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  if ($null -eq $img) { return $null }
  $ms = New-Object System.IO.MemoryStream
  $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
  $bytes = $ms.ToArray(); $ms.Dispose()
  if ($bytes.Length -gt $MAXIMG) { return $null }
  return , $bytes
}

function Insert-Row($obj) {
  try {
    $res = Invoke-RestMethod -Method Post -Uri "$URL/rest/v1/clips" `
      -Headers @{ apikey = $KEY; Authorization = "Bearer $token"; Prefer = "return=representation" } `
      -ContentType "application/json; charset=utf-8" `
      -Body ([System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json)))
    if ($res) { $script:lastRemoteAt = $res[0].created_at }
    return $true
  } catch { Login; return $false }
}

$lastText = Get-Clipboard -Raw
$lastImgHash = $null
$img0 = Get-ClipImageBytes
if ($img0) { $lastImgHash = Get-Hash $img0 }
$lastRemoteAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Write-Host "Watching clipboard - text & image (two-way: $twoWay)"

while ($true) {
  Start-Sleep -Milliseconds 1200

  # 1) 로컬 변경 → 업로드 (텍스트 우선, 텍스트 없으면 이미지)
  $text = Get-Clipboard -Raw
  if ($text -and $text.Trim() -ne "" -and $text -ne $lastText) {
    $lastText = $text
    if ($text.Length -gt 10000) { $text = $text.Substring(0, 10000) }
    if (Insert-Row @{ user_id = $uid; content = $text; kind = "text"; device = $DEVICE }) {
      Write-Host "Uploaded(text): $($text.Substring(0, [Math]::Min(40, $text.Length)))"
      Show-Note "복사한 내용을 다른 기기로 보냈어요 ✓"
    }
  }
  elseif (-not $text -or $text.Trim() -eq "") {
    $img = Get-ClipImageBytes
    if ($img) {
      $h = Get-Hash $img
      if ($h -ne $lastImgHash) {
        $lastImgHash = $h
        $fp = "$uid/$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$($h.Substring(0,8).ToLower()).png"
        try {
          Invoke-RestMethod -Method Post -Uri "$URL/storage/v1/object/clips/$fp" `
            -Headers @{ apikey = $KEY; Authorization = "Bearer $token" } `
            -ContentType "image/png" -Body $img | Out-Null
          if (Insert-Row @{ user_id = $uid; content = "[이미지]"; kind = "image"; file_path = $fp; device = $DEVICE }) {
            Write-Host "Uploaded(image): $([Math]::Round($img.Length/1024))KB"
            Show-Note "복사한 이미지를 다른 기기로 보냈어요 ✓"
          }
        } catch { Login }
      }
    }
  }

  # 2) 다른 기기의 새 클립 → 이 기기 클립보드로
  if ($twoWay) {
    try {
      $enc = [uri]::EscapeDataString($lastRemoteAt)
      $rows = Invoke-RestMethod -Method Get `
        -Uri "$URL/rest/v1/clips?select=content,device,created_at,kind,file_path&user_id=eq.$uid&created_at=gt.$enc&device=neq.$DEVICE&order=created_at.desc&limit=1" `
        -Headers @{ apikey = $KEY; Authorization = "Bearer $token" }
      if ($rows -and $rows.Count -gt 0) {
        $row = $rows[0]
        $lastRemoteAt = $row.created_at
        if ($row.kind -eq "image" -and $row.file_path) {
          $tmp = Join-Path $env:TEMP "pinlog-clip-recv.png"
          Invoke-WebRequest -Uri "$URL/storage/v1/object/clips/$($row.file_path)" `
            -Headers @{ apikey = $KEY; Authorization = "Bearer $token" } -OutFile $tmp
          $bytes = [System.IO.File]::ReadAllBytes($tmp)
          $lastImgHash = Get-Hash $bytes
          $recv = [System.Drawing.Image]::FromFile($tmp)
          [System.Windows.Forms.Clipboard]::SetImage($recv)
          $recv.Dispose()
          Write-Host "Received(image) -> clipboard: $($row.device)"
          Show-Note "$($row.device)에서 이미지가 도착했어요 — 바로 붙여넣기 하세요"
        } else {
          $lastText = $row.content
          Set-Clipboard -Value $row.content
          Write-Host "Received -> clipboard: $($row.device) - $($row.content.Substring(0, [Math]::Min(40, $row.content.Length)))"
          Show-Note "$($row.device)에서 복사한 내용이 도착했어요 — 바로 붙여넣기 하세요"
        }
      }
    } catch { }
  }
}

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
$MAXFILE = 25MB
$RECVDIR = Join-Path $env:TEMP "pinlog-clips"

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

function Get-ClipFilePath {
  # 탐색기에서 Ctrl+C 한 파일 (첫 번째 1개, 25MB 이하)
  if (-not [System.Windows.Forms.Clipboard]::ContainsFileDropList()) { return $null }
  $list = [System.Windows.Forms.Clipboard]::GetFileDropList()
  if ($null -eq $list -or $list.Count -eq 0) { return $null }
  $p = $list[0]
  if (-not (Test-Path $p -PathType Leaf)) { return $null }
  $len = (Get-Item $p).Length
  if ($len -eq 0 -or $len -gt $MAXFILE) { return $null }
  return $p
}

function Get-SafeExt($name) {
  $e = [System.IO.Path]::GetExtension($name).TrimStart('.').ToLower() -replace '[^a-z0-9]', ''
  if ($e -and $e.Length -le 10) { return $e } else { return "bin" }
}

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
$lastFileHash = $null
$img0 = Get-ClipImageBytes
if ($img0) { $lastImgHash = Get-Hash $img0 }
$file0 = Get-ClipFilePath
if ($file0) { $lastFileHash = Get-Hash ([System.IO.File]::ReadAllBytes($file0)) }
$lastRemoteAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
Write-Host "Watching clipboard - text, image & file (two-way: $twoWay)"

while ($true) {
  Start-Sleep -Milliseconds 1200

  # 0) 파일 복사 최우선 — 원본 바이트 그대로 업로드
  $fpath = Get-ClipFilePath
  if ($fpath) {
    $bytes = $null
    try { $bytes = [System.IO.File]::ReadAllBytes($fpath) } catch { }
    if ($bytes -and $bytes.Length -gt 0 -and $bytes.Length -le $MAXFILE) {
      $h = Get-Hash $bytes
      if ($h -ne $lastFileHash) {
        $lastFileHash = $h
        $lastText = Get-Clipboard -Raw   # 파일명 텍스트 중복 업로드 방지
        $name = [System.IO.Path]::GetFileName($fpath)
        $ext = Get-SafeExt $name
        $fp = "$uid/$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$($h.Substring(0,8).ToLower()).$ext"
        try {
          Invoke-RestMethod -Method Post -Uri "$URL/storage/v1/object/clips/$fp" `
            -Headers @{ apikey = $KEY; Authorization = "Bearer $token" } `
            -ContentType "application/octet-stream" -Body $bytes | Out-Null
          if (Insert-Row @{ user_id = $uid; content = $name; kind = "file"; file_path = $fp; device = $DEVICE }) {
            Write-Host "Uploaded(file): $name $([Math]::Round($bytes.Length/1024))KB"
            Show-Note "복사한 파일을 다른 기기로 보냈어요 - $name"
          }
        } catch { Login }
      }
    }
  }

  # 1) 로컬 변경 → 업로드 (파일이 클립보드에 있으면 파일명 텍스트·이미지는 무시)
  $text = Get-Clipboard -Raw
  if ($fpath) { }
  elseif ($text -and $text.Trim() -ne "" -and $text -ne $lastText) {
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
        if ($row.kind -eq "file" -and $row.file_path) {
          if (!(Test-Path $RECVDIR)) { New-Item -ItemType Directory -Path $RECVDIR | Out-Null }
          $name = ($row.content -replace '[\\/:*?"<>|]', '_')
          if (-not $name) { $name = "clip.bin" }
          $dest = Join-Path $RECVDIR $name
          Invoke-WebRequest -Uri "$URL/storage/v1/object/clips/$($row.file_path)" `
            -Headers @{ apikey = $KEY; Authorization = "Bearer $token" } -OutFile $dest
          $lastFileHash = Get-Hash ([System.IO.File]::ReadAllBytes($dest))
          $sc = New-Object System.Collections.Specialized.StringCollection
          $sc.Add($dest) | Out-Null
          [System.Windows.Forms.Clipboard]::SetFileDropList($sc)
          Write-Host "Received(file) -> clipboard: $($row.device) - $name"
          Show-Note "$($row.device)에서 파일이 도착했어요 - $name (바로 붙여넣기)"
        }
        elseif ($row.kind -eq "image" -and $row.file_path) {
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

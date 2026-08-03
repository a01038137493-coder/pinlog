#!/bin/bash
# 핀로그 클립싱크 — macOS 상시 실행 등록 (launchd)
# 사용: ./install-mac.sh   (설정 파일 ~/.pinlog-clipsync.json 먼저 준비)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node)"
[ -z "$NODE" ] && { echo "node가 필요합니다 (https://nodejs.org)"; exit 1; }
[ -f "$HOME/.pinlog-clipsync.json" ] || { echo "먼저 ~/.pinlog-clipsync.json 을 만들어주세요"; exit 1; }

PLIST="$HOME/Library/LaunchAgents/kr.pinlog.clipsync.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>kr.pinlog.clipsync</string>
  <key>ProgramArguments</key>
  <array><string>${NODE}</string><string>${DIR}/clipsync.js</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/pinlog-clipsync.log</string>
  <key>StandardErrorPath</key><string>/tmp/pinlog-clipsync.log</string>
</dict>
</plist>
EOF
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "등록 완료 — 로그: tail -f /tmp/pinlog-clipsync.log"

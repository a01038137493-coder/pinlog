#!/bin/bash
# 핀로그 클립싱크 — macOS 원클릭 설치
# 사용: bash -c "$(curl -fsSL https://www.pinlog.kr/clipsync/setup-mac.sh)"
set -e

echo "📌 핀로그 클립싱크 설치를 시작합니다"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js가 필요합니다. https://nodejs.org 에서 설치 후 다시 실행해주세요."
  exit 1
fi

DIR="$HOME/.pinlog"
mkdir -p "$DIR"
curl -fsSL "https://www.pinlog.kr/clipsync/clipsync.js" -o "$DIR/clipsync.js"

EMAIL="${PINLOG_EMAIL:-}"
PW="${PINLOG_PW:-}"
if [ -z "$EMAIL" ]; then read -r -p "핀로그 이메일: " EMAIL < /dev/tty; fi
if [ -z "$PW" ]; then read -r -s -p "연결 암호 (핀로그 클립보드 페이지에서 생성): " PW < /dev/tty; echo; fi

CFG="$HOME/.pinlog-clipsync.json"
printf '{ "email": "%s", "password": "%s", "twoWay": true }\n' "$EMAIL" "$PW" > "$CFG"
chmod 600 "$CFG"

NODE="$(command -v node)"
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
sleep 3

if grep -q "로그인 완료" /tmp/pinlog-clipsync.log 2>/dev/null; then
  echo "✅ 설치 완료! 이제 복사(⌘C)만 하면 다른 기기와 자동 동기화됩니다."
  echo "   로그 확인: tail -f /tmp/pinlog-clipsync.log"
  echo "   해제: launchctl unload ~/Library/LaunchAgents/kr.pinlog.clipsync.plist"
else
  echo "⚠️ 시작했지만 로그인 확인이 안 됐어요. 로그를 확인해주세요:"
  tail -3 /tmp/pinlog-clipsync.log 2>/dev/null || true
fi

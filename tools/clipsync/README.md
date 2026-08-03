# 핀로그 클립싱크 (기기 간 클립보드 자동 동기화)

맥북에서 ⌘C → 윈도우에서 바로 Ctrl+V (반대도 동일).
각 컴퓨터에서 백그라운드 에이전트가 클립보드를 감시해 핀로그 계정으로 동기화한다.
모바일·기록 조회는 앱/웹의 **설정 → 클립보드** 페이지.

## 공통 준비
홈 폴더에 `.pinlog-clipsync.json` 생성:

```json
{ "email": "핀로그 계정 이메일", "password": "비밀번호", "twoWay": true }
```

- `twoWay: false` 로 두면 업로드만 하고 이 기기의 클립보드는 건드리지 않음
- 카카오/구글로만 가입한 계정은 비밀번호가 없으므로 비밀번호를 먼저 발급받아야 함

## macOS (Node 필요)
```bash
cd tools/clipsync
./install-mac.sh        # launchd 등록 — 로그인 시 자동 시작
tail -f /tmp/pinlog-clipsync.log
```
해제: `launchctl unload ~/Library/LaunchAgents/kr.pinlog.clipsync.plist`

## Windows (Node 불필요 — PowerShell 단독)
1. `clipsync.ps1` + `install-win.bat` 두 파일을 PC 아무 폴더에 복사
2. `%USERPROFILE%\.pinlog-clipsync.json` 생성 (위 공통 준비)
3. `install-win.bat` 더블클릭 → 로그인 시 자동 시작 등록
4. 바로 시작: `schtasks /Run /TN "PinlogClipSync"`

해제: `schtasks /Delete /TN "PinlogClipSync" /F`

## 동작
- 1.2초 간격으로 로컬 클립보드 감시 → 변경 시 업로드 (10,000자 제한, 텍스트만)
- 2.5초 간격으로 다른 기기의 새 클립 확인 → 이 기기 클립보드에 자동 반영
- 시작 시점의 기존 클립보드 내용은 업로드하지 않음
- 토큰 만료 시 자동 재로그인

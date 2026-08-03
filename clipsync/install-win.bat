@echo off
rem 핀로그 클립싱크 — Windows 로그인 시 자동 시작 등록
rem 사용: 이 폴더(clipsync.ps1 포함)를 PC 아무 곳에 두고 install-win.bat 더블클릭
rem 설정 파일 %USERPROFILE%\.pinlog-clipsync.json 먼저 준비
set DIR=%~dp0
schtasks /Create /F /SC ONLOGON /TN "PinlogClipSync" ^
  /TR "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DIR%clipsync.ps1\""
echo 등록 완료. 지금 바로 시작하려면:
echo   schtasks /Run /TN "PinlogClipSync"
pause

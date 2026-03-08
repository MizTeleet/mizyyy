@echo off
setlocal
cd /d "%~dp0"

if exist "dist\LeetMusic.exe" (
  echo [LeetMusic] Launching dist\LeetMusic.exe
  start "" "dist\LeetMusic.exe"
  exit /b 0
)

echo [LeetMusic] EXE not found, building first...
call "%~dp0build_windows_exe.bat" || exit /b 1

if exist "dist\LeetMusic.exe" (
  start "" "dist\LeetMusic.exe"
  exit /b 0
)

echo [LeetMusic] Could not launch EXE.
pause
exit /b 1

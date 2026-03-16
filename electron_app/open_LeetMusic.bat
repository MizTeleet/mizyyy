@echo off
setlocal
cd /d "%~dp0"

set "APP_EXE=%CD%\dist\LeetMusic.exe"

if exist "%APP_EXE%" (
  echo [LeetMusic] Starting EXE...
  start "" "%APP_EXE%"
  exit /b 0
)

echo [LeetMusic] EXE not found. Building first...
call "%CD%\build_windows_exe.bat"
if errorlevel 1 goto :error

if exist "%APP_EXE%" (
  echo [LeetMusic] Starting EXE...
  start "" "%APP_EXE%"
  exit /b 0
)

echo [LeetMusic] Build finished but EXE not found.
goto :error

:error
echo.
echo Failed to open LeetMusic EXE.
pause
exit /b 1

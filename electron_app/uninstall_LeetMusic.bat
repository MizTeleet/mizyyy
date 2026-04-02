@echo off
setlocal

set "APPDATA_DIR=%APPDATA%\LeetMusic"
set "MUSIC_DIR=%USERPROFILE%\Music\LeetMusic"

echo This will remove LeetMusic data folders.
set /p CONFIRM=Continue? (y/N): 
if /I not "%CONFIRM%"=="y" exit /b 0

if exist "%APPDATA_DIR%" (
  rmdir /s /q "%APPDATA_DIR%"
  echo Removed: %APPDATA_DIR%
)

if exist "%MUSIC_DIR%" (
  rmdir /s /q "%MUSIC_DIR%"
  echo Removed: %MUSIC_DIR%
)

echo Uninstall cleanup done.
pause

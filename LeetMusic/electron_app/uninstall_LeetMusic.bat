@echo off
setlocal

echo [LeetMusic] Removing app data...
if exist "%APPDATA%\LeetMusic" rmdir /s /q "%APPDATA%\LeetMusic"
if exist "%USERPROFILE%\Music\LeetMusic" rmdir /s /q "%USERPROFILE%\Music\LeetMusic"

echo Done.
pause
exit /b 0

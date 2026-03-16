@echo off
setlocal
cd /d "%~dp0"

echo [LeetMusic] Installing dependencies...
call npm install || goto :error

echo [LeetMusic] Building Windows EXE...
call npm run build || goto :error

echo.
echo Done. EXE is in: %CD%\dist\LeetMusic.exe
pause
exit /b 0

:error
echo.
echo Build failed.
pause
exit /b 1

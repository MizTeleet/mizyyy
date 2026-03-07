@echo off
cd /d %~dp0
py -m pip install -r requirements.txt
py -m PyInstaller --noconfirm --clean --windowed --onefile --name LeetMusicEXE main.py

echo.
echo Готово! EXE в папке: %~dp0dist\LeetMusicEXE.exe
pause

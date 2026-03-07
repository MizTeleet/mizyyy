# LeetMusic Desktop EXE

Это отдельная desktop-версия LeetMusic (не браузер), написанная на Python + Tkinter + pygame.

## Как собрать `.exe` на Windows
1. Откройте папку `desktop_exe`.
2. Запустите `build_exe.bat`.
3. После сборки `.exe` будет в `desktop_exe/dist/LeetMusicEXE.exe`.

## Где хранить музыку
Положите файлы в:

- `desktop_exe/Music/`

Поддерживаются: `mp3`, `wav`, `ogg`, `flac`, `m4a`.

## Режимы повтора
- `➡` — после конца трека идёт следующий
- `🔂` — повтор текущего трека
- `🔁` — повтор всего списка

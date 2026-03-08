# LeetMusic Desktop (только программа)

В проекте оставлена только desktop-версия плеера (Tkinter + pygame).
Браузерная версия и локальные web-лаунчеры удалены.

## Запуск как программа (без сборки)
```bash
python main.py
```

## Сборка `.exe` на Windows
```bash
python build_exe.py
```
После сборки файл будет в:

- `desktop_exe/dist/LeetMusicEXE.exe`

## Где хранить музыку
Кладите треки в папку:

- `desktop_exe/Music/`

Поддерживаемые форматы: `mp3`, `wav`, `ogg`, `flac`, `m4a`.

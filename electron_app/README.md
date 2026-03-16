# LeetMusic Electron App

Структура проекта:

- `electron_app/main.js`
- `electron_app/preload.js`
- `electron_app/renderer/`
- `electron_app/yt-dlp.exe`

## Возможности
- локальные треки из `Music/LeetMusic`
- импорт музыки через 🎵
- избранное + редактирование
- эквалайзер (bass/mid/treble/vocal + presets)
- поиск YouTube (ytsr)
- результаты с кнопками: Play / Download / Add to favorites
- в поиске YouTube отображается максимум 5 результатов
- Play для YouTube через `yt-dlp` stream URL

## Установка
```bash
cd electron_app
npm install
```

## Запуск
```bash
npm start
```

## Сборка `.exe` (Windows)
- `electron_app/build_windows_exe.bat`

## One-click open
- `electron_app/open_LeetMusic.bat`

## Uninstaller
- `electron_app/uninstall_LeetMusic.bat`


Важно: файл `yt-dlp.exe` должен быть валидным бинарником yt-dlp для Windows.
Если заменяете его вручную — оставьте то же имя файла.

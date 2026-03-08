# LeetMusic Electron App

Современная desktop-версия плеера на HTML/CSS/JavaScript (Electron).

## Возможности
- список треков из папки `Music/`
- импорт музыки через диалог
- выбор трека
- play / pause / prev / next
- карточка текущего трека
- fog overlay при воспроизведении

## Запуск
```bash
cd LeetMusic/electron_app
npm install
npm start
```

## Сборка `.exe` (Windows)
### Вариант 1 (проще)
Запусти файл:

- `LeetMusic/electron_app/build_windows_exe.bat`

Он сам установит зависимости и соберет `.exe`.

### Вариант 2 (вручную)
```bash
cd LeetMusic/electron_app
npm install
npm run build
```

## Где хранить музыку
Скопируйте треки в:

- `LeetMusic/electron_app/Music/`

Поддерживаемые форматы: `mp3`, `wav`, `ogg`, `flac`, `m4a`.

После сборки приложение будет тут:

- `LeetMusic/electron_app/dist/LeetMusic.exe`

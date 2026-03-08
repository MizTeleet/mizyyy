# LeetMusic Electron App

Современная desktop-версия плеера на HTML/CSS/JavaScript (Electron).

## Возможности
- список треков из папки `Music/`
- импорт музыки через диалог
- выбор трека
- play / pause / prev / next
- карточка текущего трека
- fog overlay при воспроизведении

## Открыть плеер одним кликом (Windows)
Запусти файл:

- `LeetMusic/electron_app/open_LeetMusic.bat`

Что делает скрипт:
- если `dist/LeetMusic.exe` уже есть — сразу открывает плеер;
- если нет — сначала собирает `.exe`, потом автоматически запускает его.

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
Теперь музыка хранится в системной папке Music пользователя:

- `Музыка/LeetMusic` (Windows)

Пример: `C:\Users\<user>\Music\LeetMusic`.

Поддерживаемые форматы: `mp3`, `wav`, `ogg`, `flac`, `m4a`.

После сборки приложение будет тут:

- `LeetMusic/electron_app/dist/LeetMusic.exe`

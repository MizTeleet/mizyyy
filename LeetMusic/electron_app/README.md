# LeetMusic Electron App

Современная desktop-версия плеера на HTML/CSS/JavaScript (Electron).

## Возможности
- список треков без дублирования названий
- импорт музыки через иконку 🎵 в левом меню
- вкладки навигации: главная / плеер / избранное
- play / pause / prev / next
- карточка текущего трека
- редактирование избранных: название, описание, обложка, экспорт на ПК
- эквалайзер в отдельном прозрачном окне (bass/mid/treble/vocal + presets)
- fog overlay + glassmorphism UI

## Зависимость для YouTube-поиска/воспроизведения
Для онлайн-воспроизведения через YouTube требуется установленный `yt-dlp` в системе (`yt-dlp` должен быть доступен в PATH).

Примеры установки:
- Windows (winget): `winget install yt-dlp.yt-dlp`
- Linux (pipx): `pipx install yt-dlp`

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

> `npm run build` теперь всегда делает **чистую сборку**: удаляет старый `dist/` и выводит хэши входных файлов `src/main.js` и `src/renderer/renderer.js`, чтобы в `.exe` точно попали последние изменения.

## Где хранить музыку
Теперь музыка хранится в системной папке Music пользователя:

- `~/Music/LeetMusic` (Linux/macOS)
- `C:\Users\<user>\Music\LeetMusic` (Windows)

Поддерживаемые форматы: `mp3`, `wav`, `ogg`, `flac`, `m4a`.

После сборки приложение будет тут:

- `LeetMusic/electron_app/dist/LeetMusic.exe`

## Удаление (uninstaller)
Запусти:

- `LeetMusic/electron_app/uninstall_LeetMusic.bat`

Скрипт удаляет папки данных LeetMusic из `%APPDATA%` и `%USERPROFILE%\Music\LeetMusic`.

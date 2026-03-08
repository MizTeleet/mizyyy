const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const DEFAULT_SEARCH_LIMIT = 20;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('music:search', async (_, query) => {
  const term = String(query || '').trim();

  if (!term) {
    return { tracks: [], error: 'Введите запрос для поиска.' };
  }

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', String(DEFAULT_SEARCH_LIMIT));

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return { tracks: [], error: `Ошибка сервиса: ${response.status}` };
    }

    const data = await response.json();
    const tracks = (data.results || [])
      .filter((track) => track.previewUrl)
      .map((track) => ({
        id: track.trackId,
        title: track.trackName,
        artist: track.artistName,
        album: track.collectionName,
        previewUrl: track.previewUrl,
        coverUrl: track.artworkUrl100,
        durationMs: track.trackTimeMillis
      }));

    return { tracks, error: null };
  } catch (error) {
    return { tracks: [], error: `Сетевая ошибка: ${error.message}` };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

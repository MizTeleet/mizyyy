const path = require('path');
const { fork } = require('child_process');
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  session,
} = require('electron');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

const PORT = process.env.PORT || 3030;
let serverProcess = null;
let blocker = null;
let networkBlockingInitialized = false;

async function setupAdBlock() {
  if (blocker) {
    return;
  }

  blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(session.defaultSession);
}

function setupAggressiveNetworkBlocking() {
  if (networkBlockingInitialized) {
    return;
  }

  networkBlockingInitialized = true;

  const urlPatterns = [
    '*://*/*ads*',
    '*://*/*ad*',
    '*://*.doubleclick.net/*',
    '*://*.googlesyndication.com/*',
    '*://*/*vast*',
    '*://*/*banner*',
    '*://*/*video-ad*',
    '*://*.yandex.ru/ads/*',
    '*://adriver.ru/*',
    '*://*.adriver.ru/*',
  ];

  session.defaultSession.webRequest.onBeforeRequest({ urls: urlPatterns }, (details, callback) => {
    callback({ cancel: true });
  });
}

function startBackend() {
  if (serverProcess) {
    return;
  }

  serverProcess = fork(path.join(__dirname, 'server.js'), [], {
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: 'inherit',
  });

  serverProcess.on('exit', () => {
    serverProcess = null;
  });
}

function stopBackend() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  serverProcess = null;
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

function installMoviePageCleanup(movieWindow) {
  const runCleanupScript = `
    (() => {
      // Пытаемся скипнуть рекламу через video
      document.querySelectorAll('video').forEach(v => {
        try {
          v.muted = true;
          v.currentTime = v.duration || 9999;
          v.play?.();
        } catch (e) {}
      });

      if (!window.__adCleanerInterval) {
        window.__adCleanerInterval = setInterval(() => {
          // Удаляем iframe-рекламу, но не трогаем iframe внутри активного плеера
          document.querySelectorAll('iframe').forEach(el => {
            try {
              const insidePlayer = el.closest('[class*="player"], [id*="player"]');
              if (!insidePlayer) {
                el.remove();
              }
            } catch (e) {}
          });

          // Удаляем явные рекламные блоки
          document.querySelectorAll('[class*="ad"], [id*="ad"], [class*="banner"], [id*="banner"]').forEach(el => {
            try {
              const text = (el.textContent || '').toLowerCase();
              const keepPlayer = el.closest('[class*="player"], [id*="player"], video');
              if (!keepPlayer || text.includes('реклама') || text.includes('advert')) {
                el.remove();
              }
            } catch (e) {}
          });

          // Повторная попытка скипа видео-рекламы
          document.querySelectorAll('video').forEach(v => {
            try {
              if (v.duration > 0) {
                v.currentTime = v.duration;
              }
            } catch (e) {}
          });
        }, 1500);
      }
    })();
  `;

  const safeExecute = () => {
    if (movieWindow.isDestroyed()) {
      return;
    }

    movieWindow.webContents.executeJavaScript(runCleanupScript).catch(() => {
      // Игнорируем ошибки инжекта на страницах с CSP/переходах
    });
  };

  movieWindow.webContents.on('did-finish-load', safeExecute);
  movieWindow.webContents.on('did-navigate', safeExecute);
}

function openMovieWindow(movieId) {
  if (!movieId) {
    return;
  }

  const movieWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  installMoviePageCleanup(movieWindow);
  movieWindow.loadURL(`https://www.kinopoisk.net/film/${movieId}/`);
}

ipcMain.handle('open-movie', (_event, movieId) => {
  openMovieWindow(movieId);
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  startBackend();
  setupAggressiveNetworkBlocking();

  try {
    await setupAdBlock();
  } catch (error) {
    console.warn('[adblock] init failed:', error?.message || error);
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

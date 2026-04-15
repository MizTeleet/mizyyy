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

function setupSafeNetworkBlocking() {
  if (networkBlockingInitialized) {
    return;
  }

  networkBlockingInitialized = true;

  const urlPatterns = [
    '*://*.doubleclick.net/*',
    '*://*.googlesyndication.com/*',
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
      if (!window.__movieSafeCleanerInterval) {
        window.__movieSafeCleanerInterval = setInterval(() => {
          // Удаляем только явные banner-элементы (не трогаем iframe и video)
          document.querySelectorAll('[class*="banner"], [id*="banner"]').forEach(el => {
            try {
              el.remove();
            } catch (e) {}
          });

          // Аккуратный скип коротких видео (возможные прероллы)
          document.querySelectorAll('video').forEach(v => {
            try {
              if (v.duration && v.duration < 60) {
                v.currentTime = v.duration;
              }
            } catch (e) {}
          });
        }, 2000);
      }
    })();
  `;

  const safeExecute = () => {
    if (movieWindow.isDestroyed()) {
      return;
    }

    movieWindow.webContents.executeJavaScript(runCleanupScript).catch(() => {
      // Игнорируем ошибки инжекта на переходах/CSP
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
  setupSafeNetworkBlocking();

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

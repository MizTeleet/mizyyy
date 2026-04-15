const path = require('path');
const { fork } = require('child_process');
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  session,
  shell,
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

function installMoviePageAdSkip(movieWindow) {
  const runAdSkipScript = `
    (() => {
      const patchCurrentTime = () => {
        document.querySelectorAll('video').forEach(v => {
          try {
            if (v.__patchedCurrentTime) {
              return;
            }

            Object.defineProperty(v, 'currentTime', {
              configurable: true,
              get() {
                return this._time || 0;
              },
              set(val) {
                this._time = val;
              },
            });

            v.__patchedCurrentTime = true;
          } catch (e) {}
        });
      };

      const forceSeekAndPlay = () => {
        document.querySelectorAll('video').forEach(v => {
          try {
            v.pause();
            v.currentTime = 9999;
            v.play?.();
          } catch (e) {}
        });
      };

      const speedupAds = () => {
        document.querySelectorAll('video').forEach(v => {
          try {
            v.playbackRate = 16;
            v.muted = true;
          } catch (e) {}
        });
      };

      const requestPiPForFirstVideo = async () => {
        const video = document.querySelector('video');
        if (!video || !document.pictureInPictureEnabled) {
          return;
        }

        try {
          if (document.pictureInPictureElement !== video) {
            await video.requestPictureInPicture();
          }
        } catch (e) {}
      };

      if (!document.getElementById('__skipAdButton')) {
        const btn = document.createElement('button');
        btn.id = '__skipAdButton';
        btn.innerText = 'Пропустить рекламу';
        btn.style.position = 'fixed';
        btn.style.top = '20px';
        btn.style.right = '20px';
        btn.style.zIndex = '999999';
        btn.style.padding = '10px 15px';
        btn.style.background = 'red';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '8px';
        btn.style.cursor = 'pointer';

        btn.onclick = () => {
          patchCurrentTime();
          forceSeekAndPlay();
          speedupAds();
        };

        document.body.appendChild(btn);
      }

      if (!document.getElementById('__pipButton')) {
        const pipBtn = document.createElement('button');
        pipBtn.id = '__pipButton';
        pipBtn.innerText = '📺 PiP режим';
        pipBtn.style.position = 'fixed';
        pipBtn.style.bottom = '20px';
        pipBtn.style.right = '20px';
        pipBtn.style.zIndex = '999999';
        pipBtn.style.padding = '10px';
        pipBtn.style.background = 'black';
        pipBtn.style.color = 'white';
        pipBtn.style.border = 'none';
        pipBtn.style.borderRadius = '8px';
        pipBtn.style.cursor = 'pointer';

        pipBtn.onclick = async () => {
          await requestPiPForFirstVideo();
        };

        document.body.appendChild(pipBtn);
      }

      if (!window.__moviePiPTimeout) {
        window.__moviePiPTimeout = setTimeout(() => {
          requestPiPForFirstVideo();
        }, 3000);
      }

      if (!window.__movieAdSkipInterval) {
        window.__movieAdSkipInterval = setInterval(() => {
          patchCurrentTime();
          forceSeekAndPlay();
          speedupAds();
        }, 1000);
      }
    })();
  `;

  const safeExecute = () => {
    if (movieWindow.isDestroyed()) {
      return;
    }

    movieWindow.webContents.executeJavaScript(runAdSkipScript).catch(() => {
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

  installMoviePageAdSkip(movieWindow);
  movieWindow.loadURL(`https://www.kinopoisk.net/film/${movieId}/`);
}

ipcMain.handle('open-movie', (_event, movieId) => {
  openMovieWindow(movieId);
});

ipcMain.handle('open-movie-external', (_event, movieId) => {
  if (!movieId) {
    return;
  }

  shell.openExternal(`https://www.kinopoisk.net/film/${movieId}/`);
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

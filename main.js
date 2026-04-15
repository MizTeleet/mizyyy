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

async function setupAdBlock() {
  if (blocker) {
    return;
  }

  blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(session.defaultSession);
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

  movieWindow.loadURL(`https://www.kinopoisk.net/film/${movieId}/`);
}

ipcMain.handle('open-movie', (_event, movieId) => {
  openMovieWindow(movieId);
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  startBackend();

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

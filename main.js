const path = require('path');
const { fork } = require('child_process');
const { app, BrowserWindow } = require('electron');

const PORT = process.env.PORT || 3030;
let serverProcess = null;

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

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  startBackend();
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

app.on('before-quit', () => {
  stopBackend();
});

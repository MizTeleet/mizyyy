const path = require('path');
const fs = require('fs/promises');
const { fork } = require('child_process');
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');

const APP_NAME = 'LeetFilms';
const PORT = process.env.PORT || 3030;
let serverProcess = null;

async function ensureAppDataDir() {
  const dataDir = path.join(app.getPath('documents'), APP_NAME);
  await fs.mkdir(dataDir, { recursive: true });

  const defaults = {
    'favorites.json': '[]\n',
    'user.json': '{"name":"","createdAt":""}\n',
    'notes.json': '[]\n',
  };

  await Promise.all(
    Object.entries(defaults).map(async ([name, content]) => {
      const filePath = path.join(dataDir, name);
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, content, 'utf8');
      }
    }),
  );

  return dataDir;
}

function startBackend(dataDir) {
  if (serverProcess) return;

  serverProcess = fork(path.join(__dirname, 'server.js'), [], {
    env: {
      ...process.env,
      PORT: String(PORT),
      LEETFILMS_DATA_DIR: dataDir,
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
  const window = new BrowserWindow({
    title: APP_NAME,
    width: 1260,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile(path.join(__dirname, 'index.html'));
}

function openMovieInApp(movieId) {
  if (!movieId) return false;

  const movieWindow = new BrowserWindow({
    title: `${APP_NAME} — Плеер`,
    width: 1200,
    height: 780,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  movieWindow.loadURL(`https://www.kinopoisk.net/film/${movieId}/`);

  const cleanupOverlayScript = `
    (() => {
      const selectors = [
        '#__skipAdButton',
        '#__pipButton',
        '.tg-logo',
        'a[href*="t.me"]',
        'a[href*="telegram"]',
        '[class*="telegram"]',
        '[id*="telegram"]',
      ];

      const removeJunk = () => {
        selectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        });

        document.querySelectorAll('button, a').forEach((el) => {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes('пропустить рекламу')) {
            el.remove();
          }
        });
      };

      removeJunk();

      if (!document.getElementById('__leetfilms_overlay_fix')) {
        const style = document.createElement('style');
        style.textContent =
          '.player-overlay-fix {' +
          'position:absolute;top:0;left:0;width:100%;height:140px;' +
          'background:linear-gradient(to bottom,#0b1220,transparent);' +
          'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'z-index:2147483647;pointer-events:none;}' +
          '.player-overlay-fix h1 {color:white;font-size:32px;font-weight:bold;margin:0;}' +
          '.player-overlay-fix p {color:#aaa;font-size:14px;margin:6px 0 0;}';
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = '__leetfilms_overlay_fix';
        overlay.className = 'player-overlay-fix';
        overlay.innerHTML = '<h1>LEET FILMS</h1><p>Приятного просмотра</p>';
        document.body.appendChild(overlay);
      }

      setInterval(removeJunk, 1500);
    })();
  `;

  movieWindow.webContents.on('did-finish-load', () => {
    movieWindow.webContents.executeJavaScript(cleanupOverlayScript).catch(() => {});
  });
  return true;
}

ipcMain.handle('open-movie', (_event, movieId) => openMovieInApp(movieId));

ipcMain.handle('open-external-url', (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return false;
  }

  shell.openExternal(url);
  return true;
});

app.whenReady().then(async () => {
  app.setName(APP_NAME);
  Menu.setApplicationMenu(null);

  const dataDir = await ensureAppDataDir();
  startBackend(dataDir);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopBackend);

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);

const appRoot = app.getAppPath();
const musicDir = path.join(appRoot, 'Music');

async function ensureMusicDir() {
  await fs.mkdir(musicDir, { recursive: true });
}

async function listTracks() {
  await ensureMusicDir();
  const entries = await fs.readdir(musicDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((name) => ({
      id: name,
      name,
      title: path.parse(name).name,
      fileUrl: pathToFileURL(path.join(musicDir, name)).href,
    }));
}

async function importTracks(win) {
  await ensureMusicDir();
  const result = await dialog.showOpenDialog(win, {
    title: 'Импорт музыки',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] }],
  });

  if (result.canceled || !result.filePaths.length) {
    return { copied: 0, tracks: await listTracks() };
  }

  let copied = 0;
  for (const sourcePath of result.filePaths) {
    const ext = path.extname(sourcePath).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;
    const dest = path.join(musicDir, path.basename(sourcePath));
    await fs.copyFile(sourcePath, dest);
    copied += 1;
  }

  return { copied, tracks: await listTracks() };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#080b12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('tracks:list', async () => listTracks());
ipcMain.handle('tracks:import', async (event) => importTracks(BrowserWindow.fromWebContents(event.sender)));

app.whenReady().then(async () => {
  await ensureMusicDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

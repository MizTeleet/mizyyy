const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const ytsr = require('ytsr');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);

function getMusicDir() {
  const systemMusicDir = app.getPath('music');
  return path.join(systemMusicDir, 'LeetMusic');
}

function getMetaFile() {
  return path.join(app.getPath('userData'), 'track_meta.json');
}

function getYtDlpPaths() {
  const localExe = path.join(app.getAppPath(), 'yt-dlp.exe');
  const fallbackExe = path.join(process.cwd(), 'yt-dlp.exe');
  return [localExe, fallbackExe, 'yt-dlp'];
}

async function resolveYtDlpBinary() {
  const candidates = getYtDlpPaths();
  for (const candidate of candidates) {
    if (candidate === 'yt-dlp') return candidate;
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {}
  }
  throw new Error('yt-dlp.exe не найден в папке electron_app');
}

function runYtDlp(args) {
  return new Promise(async (resolve, reject) => {
    let bin;
    try {
      bin = await resolveYtDlpBinary();
    } catch (e) {
      reject(e);
      return;
    }

    const proc = spawn(bin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

async function readMeta() {
  const metaFile = getMetaFile();
  try {
    return JSON.parse(await fs.readFile(metaFile, 'utf8'));
  } catch {
    return {};
  }
}

async function writeMeta(meta) {
  const metaFile = getMetaFile();
  await fs.mkdir(path.dirname(metaFile), { recursive: true });
  await fs.writeFile(metaFile, JSON.stringify(meta, null, 2), 'utf8');
}

async function ensureMusicDir() {
  const musicDir = getMusicDir();
  try {
    const stat = await fs.stat(musicDir);
    if (!stat.isDirectory()) throw new Error(`Music path exists but is not a directory: ${musicDir}`);
  } catch (error) {
    if (error && error.code === 'ENOENT') await fs.mkdir(musicDir, { recursive: true });
    else throw error;
  }
  return musicDir;
}

async function listTracks() {
  const musicDir = await ensureMusicDir();
  const entries = await fs.readdir(musicDir, { withFileTypes: true });
  const meta = await readMeta();

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
      favorite: Boolean(meta[name]?.favorite),
      customTitle: meta[name]?.customTitle || '',
      description: meta[name]?.description || '',
      coverPath: meta[name]?.coverPath || '',
    }));
}

async function importTracks(win) {
  const musicDir = await ensureMusicDir();
  const result = await dialog.showOpenDialog(win, {
    title: 'Импорт музыки',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] }],
  });

  if (result.canceled || !result.filePaths.length) return { copied: 0, tracks: await listTracks() };

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

async function saveTrackMeta(trackId, patch) {
  const meta = await readMeta();
  meta[trackId] = { ...meta[trackId], ...patch };
  await writeMeta(meta);
  return meta[trackId];
}

async function pickCover(win) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Выберите обложку',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (result.canceled || !result.filePaths.length) return '';
  return result.filePaths[0];
}

async function exportTrackCard(win, payload) {
  const result = await dialog.showSaveDialog(win, {
    title: 'Сохранить данные трека',
    defaultPath: `${payload.title || 'track'}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return false;
  await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
  return true;
}

async function searchYouTube(query) {
  if (!query || !query.trim()) return [];
  const results = await ytsr(query, { limit: 60 });
  return results.items
    .filter((item) => item.type === 'video')
    .slice(0, 30)
    .map((v) => ({
      id: v.id,
      title: v.title,
      author: v.author?.name || '',
      duration: v.duration || '',
      url: v.url,
      thumbnail: v.bestThumbnail?.url || '',
    }));
}

async function getYouTubeStreamUrl(videoUrl) {
  const out = await runYtDlp(['-g', '-f', 'bestaudio', videoUrl]);
  const line = out.split(/\r?\n/).find(Boolean);
  if (!line) throw new Error('Не удалось получить stream URL');
  return line;
}

async function downloadYouTubeAudio(videoUrl) {
  const musicDir = await ensureMusicDir();
  await runYtDlp(['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', path.join(musicDir, '%(title)s.%(ext)s'), videoUrl]);
  return await listTracks();
}

function createWindow() {
  Menu.setApplicationMenu(null);
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

  win.setMenuBarVisibility(false);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('tracks:list', async () => listTracks());
ipcMain.handle('tracks:import', async (event) => importTracks(BrowserWindow.fromWebContents(event.sender)));
ipcMain.handle('tracks:music-dir', async () => ensureMusicDir());
ipcMain.handle('tracks:meta-save', async (_event, trackId, patch) => saveTrackMeta(trackId, patch));
ipcMain.handle('tracks:pick-cover', async (event) => pickCover(BrowserWindow.fromWebContents(event.sender)));
ipcMain.handle('tracks:export-card', async (event, payload) => exportTrackCard(BrowserWindow.fromWebContents(event.sender), payload));
ipcMain.handle('yt:search', async (_event, query) => searchYouTube(query));
ipcMain.handle('yt:stream-url', async (_event, videoUrl) => getYouTubeStreamUrl(videoUrl));
ipcMain.handle('yt:download', async (_event, videoUrl) => downloadYouTubeAudio(videoUrl));

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

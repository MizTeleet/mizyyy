const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const ytsr = require('ytsr');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

function getMusicDir() {
  const systemMusicDir = app.getPath('music');
  return path.join(systemMusicDir, 'LeetMusic');
}

function getMetaFile() {
  return path.join(app.getPath('userData'), 'track_meta.json');
}

function getYtDlpPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'yt-dlp.exe')
    : path.join(__dirname, 'yt-dlp.exe');
}

async function resolveYtDlpBinary() {
  const preferred = getYtDlpPath();
  try {
    const stat = await fs.stat(preferred);
    if (!stat.isFile()) throw new Error('yt-dlp path is not a file');
    if (stat.size === 0) throw new Error('yt-dlp.exe is empty');
    return preferred;
  } catch (error) {
    throw new Error(`yt-dlp.exe not found or invalid at: ${preferred}`);
  }
}

function runYtDlp(args) {
  return new Promise(async (resolve, reject) => {
    let bin;
    try {
      bin = await resolveYtDlpBinary();
    } catch (e) {
      console.error('[yt-dlp] resolve failed:', e);
      reject(new Error('yt-dlp is missing. Please place a valid yt-dlp.exe in app resources.'));
      return;
    }
    execFile(bin, args, { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) {
        resolve(String(stdout || '').trim());
        return;
      }
      console.error('[yt-dlp] execution failed:', stderr || error.message);
      reject(new Error(stderr || error.message || 'yt-dlp execution failed'));
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
  try {
    const out = await runYtDlp(['-g', '-f', 'bestaudio', videoUrl]);
    const line = out.split(/\r?\n/).find(Boolean);
    if (!line) throw new Error('Не удалось получить stream URL');
    return line;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!message.includes('429')) throw error;
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const retryOut = await runYtDlp(['-g', '-f', 'bestaudio', videoUrl]);
    const retryLine = retryOut.split(/\r?\n/).find(Boolean);
    if (!retryLine) throw new Error('Не удалось получить stream URL');
    return retryLine;
  }
}

async function downloadYouTubeAudio(videoUrl) {
  return downloadYouTubeAudioWithDialog(null, videoUrl, 'track');
}

function sanitizeFileName(name) {
  return (name || 'track')
    .replace(INVALID_FILENAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'track';
}

async function downloadYouTubeAudioWithDialog(win, videoUrl, title) {
  const defaultName = `${sanitizeFileName(title)}.mp3`;
  const result = await dialog.showSaveDialog(win, {
    title: 'Сохранить MP3',
    defaultPath: path.join(app.getPath('music'), defaultName),
    filters: [{ name: 'MP3', extensions: ['mp3'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  const target = result.filePath.toLowerCase().endsWith('.mp3') ? result.filePath : `${result.filePath}.mp3`;
  await runYtDlp(['-x', '--audio-format', 'mp3', '--audio-quality', '0', '-o', target, videoUrl]);
  return { ok: true, filePath: target };
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
ipcMain.handle('yt:download', async (event, videoUrl, title) => downloadYouTubeAudioWithDialog(BrowserWindow.fromWebContents(event.sender), videoUrl, title));

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

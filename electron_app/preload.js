const { contextBridge, ipcRenderer } = require('electron');

const exposedApi = {
  listTracks: () => ipcRenderer.invoke('tracks:list'),
  importTracks: () => ipcRenderer.invoke('tracks:import'),
  getMusicDir: () => ipcRenderer.invoke('tracks:music-dir'),
  saveTrackMeta: (trackId, patch) => ipcRenderer.invoke('tracks:meta-save', trackId, patch),
  pickCover: () => ipcRenderer.invoke('tracks:pick-cover'),
  exportTrackCard: (payload) => ipcRenderer.invoke('tracks:export-card', payload),
  search: (query) => ipcRenderer.invoke('search', query),
  ytSearch: (query) => ipcRenderer.invoke('yt:search', query),
  ytStreamUrl: (videoUrl) => ipcRenderer.invoke('yt:stream-url', videoUrl),
  ytDownload: (videoUrl, title) => ipcRenderer.invoke('yt:download', videoUrl, title),
};

contextBridge.exposeInMainWorld('api', exposedApi);
contextBridge.exposeInMainWorld('leetMusicApi', exposedApi);

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leetMusicApi', {
  listTracks: () => ipcRenderer.invoke('tracks:list'),
  importTracks: () => ipcRenderer.invoke('tracks:import'),
  getMusicDir: () => ipcRenderer.invoke('tracks:music-dir'),
  saveTrackMeta: (trackId, patch) => ipcRenderer.invoke('tracks:meta-save', trackId, patch),
  pickCover: () => ipcRenderer.invoke('tracks:pick-cover'),
  exportTrackCard: (payload) => ipcRenderer.invoke('tracks:export-card', payload),
  ytSearch: (query) => ipcRenderer.invoke('yt:search', query),
  ytStreamUrl: (videoUrl) => ipcRenderer.invoke('yt:stream-url', videoUrl),
  ytDownload: (videoUrl) => ipcRenderer.invoke('yt:download', videoUrl),
});

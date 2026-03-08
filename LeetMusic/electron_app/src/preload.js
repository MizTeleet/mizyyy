const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leetMusicApi', {
  listTracks: () => ipcRenderer.invoke('tracks:list'),
  importTracks: () => ipcRenderer.invoke('tracks:import'),
  getMusicDir: () => ipcRenderer.invoke('tracks:music-dir'),
  saveTrackMeta: (trackId, patch) => ipcRenderer.invoke('tracks:meta-save', trackId, patch),
  pickCover: () => ipcRenderer.invoke('tracks:pick-cover'),
  exportTrackCard: (payload) => ipcRenderer.invoke('tracks:export-card', payload),
  downloadOnlineTrack: (payload) => ipcRenderer.invoke('tracks:download-online', payload),
});

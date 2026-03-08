const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leetMusicApi', {
  listTracks: () => ipcRenderer.invoke('tracks:list'),
  importTracks: () => ipcRenderer.invoke('tracks:import'),
  getMusicDir: () => ipcRenderer.invoke('tracks:music-dir'),
});

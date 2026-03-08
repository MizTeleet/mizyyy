const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('musicApi', {
  searchTracks: (query) => ipcRenderer.invoke('music:search', query)
});

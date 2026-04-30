const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openMovie: (movieId) => ipcRenderer.invoke('open-movie', movieId),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
});

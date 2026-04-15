const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openMovie: (movieId) => ipcRenderer.invoke('open-movie', movieId),
});

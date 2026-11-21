const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('xqDesktop', {
  isDesktop: true,
  platform: process.platform,
  aiChat: (req) => ipcRenderer.invoke('ai:chat', req)
});

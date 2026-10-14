'use strict';
// The only bridge between the app page and the desktop shell.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studioDesktop', {
  platform: process.platform,
  getHostInfo: () => ipcRenderer.invoke('host:get'),
  setHosting: (opts) => ipcRenderer.invoke('host:set', opts),
  openDataFolder: () => ipcRenderer.invoke('host:open-folder'),
});

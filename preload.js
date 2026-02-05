const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    hideWindow: () => ipcRenderer.invoke('hide-window'),
    downloadAsset: (url, filename) => ipcRenderer.invoke('download-asset', url, filename),
    copyToClipboard: (url, filename, ext) => ipcRenderer.invoke('copy-to-clipboard', url, filename, ext),
    onWindowShown: (callback) => ipcRenderer.on('window-shown', callback),
    onWindowHidden: (callback) => ipcRenderer.on('window-hidden', callback),
    // Keybind management
    getShortcut: () => ipcRenderer.invoke('get-shortcut'),
    setShortcut: (shortcut) => ipcRenderer.invoke('set-shortcut', shortcut),
    resetShortcut: () => ipcRenderer.invoke('reset-shortcut'),
    platform: process.platform
});

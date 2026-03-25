const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  openPdfDialog: () => ipcRenderer.invoke('dialog:openPdf'),
  getApiStatus: () => ipcRenderer.invoke('api:status'),
  processPdf: (payload) => ipcRenderer.invoke('rag:processPdf', payload),
  buildArtifacts: (payload) => ipcRenderer.invoke('generation:buildArtifacts', payload),
  createPlaceholders: (payload) => ipcRenderer.invoke('generation:createPlaceholders', payload),
  showConfirm: (options) => ipcRenderer.invoke('dialog:showConfirm', options),
  showAlert: (options) => ipcRenderer.invoke('dialog:showAlert', options),
});
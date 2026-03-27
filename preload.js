const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  openPdfDialog: () => ipcRenderer.invoke('dialog:openPdf'),
  getApiStatus: () => ipcRenderer.invoke('api:status'),
  verifyApiProviders: () => ipcRenderer.invoke('api:verify'),
  auditPairs: (payload) => ipcRenderer.invoke('audit:pairs', payload),
  repairPairs: (payload) => ipcRenderer.invoke('pairs:repair', payload),
  deferQualityLog: (payload) => ipcRenderer.invoke('pairs:deferLog', payload),
  getQualityGuardrails: (payload) => ipcRenderer.invoke('quality-memory:getGuardrails', payload),
  getQualityStability: (payload) => ipcRenderer.invoke('quality-memory:getStability', payload),
  updateQualityMemoryFromAudit: (payload) => ipcRenderer.invoke('quality-memory:updateFromAudit', payload),
  processPdf: (payload) => ipcRenderer.invoke('rag:processPdf', payload),
  buildArtifacts: (payload) => ipcRenderer.invoke('generation:buildArtifacts', payload),
  cancelGeneration: () => ipcRenderer.invoke('generation:cancel'),
  onArtifactProgress: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('generation:artifactProgress', handler);

    return () => {
      ipcRenderer.removeListener('generation:artifactProgress', handler);
    };
  },
  onGenerationLog: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('generation:statusLog', handler);

    return () => {
      ipcRenderer.removeListener('generation:statusLog', handler);
    };
  },
  showConfirm: (options) => ipcRenderer.invoke('dialog:showConfirm', options),
  showAlert: (options) => ipcRenderer.invoke('dialog:showAlert', options),
});
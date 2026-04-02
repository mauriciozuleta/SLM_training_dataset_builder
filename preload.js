const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  platform: process.platform,
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:save', payload),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectSourceEntries: () => ipcRenderer.invoke('dialog:selectSourceEntries'),
  createProjectFolders: (projectName) => ipcRenderer.invoke('project:createFolders', projectName),
  createProjectSourceSubfolder: (payload) => ipcRenderer.invoke('project:createSourceSubfolder', payload),
  inspectProjectSourceEntries: (payload) => ipcRenderer.invoke('project:inspectSourceEntries', payload),
  addProjectSourceDocuments: (payload) => ipcRenderer.invoke('project:addSourceDocuments', payload),
  ingestDroppedProjectEntries: (payload) => ipcRenderer.invoke('project:ingestDroppedEntries', payload),
  openPdfDialog: () => ipcRenderer.invoke('dialog:openPdf'),
  openJsonDialog: (payload) => ipcRenderer.invoke('dialog:openJson', payload),
  getApiStatus: () => ipcRenderer.invoke('api:status'),
  verifyApiProviders: () => ipcRenderer.invoke('api:verify'),
  auditPairs: (payload) => ipcRenderer.invoke('audit:pairs', payload),
  repairPairs: (payload) => ipcRenderer.invoke('pairs:repair', payload),
  inspectRepairArtifact: (payload) => ipcRenderer.invoke('generation:inspectRepairArtifact', payload),
  repairPartialArtifact: (payload) => ipcRenderer.invoke('generation:repairPartialArtifact', payload),
  exportTrainingFiles: (payload) => ipcRenderer.invoke('dataset:exportTrainingFiles', payload),
  deferQualityLog: (payload) => ipcRenderer.invoke('pairs:deferLog', payload),
  getQualityGuardrails: (payload) => ipcRenderer.invoke('quality-memory:getGuardrails', payload),
  getQualityStability: (payload) => ipcRenderer.invoke('quality-memory:getStability', payload),
  updateQualityMemoryFromAudit: (payload) => ipcRenderer.invoke('quality-memory:updateFromAudit', payload),
  annotateArtifactQualityMetadata: (payload) => ipcRenderer.invoke('quality:annotateArtifacts', payload),
  processPdf: (payload) => ipcRenderer.invoke('rag:processPdf', payload),
  buildArtifacts: (payload) => ipcRenderer.invoke('generation:buildArtifacts', payload),
  cancelGeneration: () => ipcRenderer.invoke('generation:cancel'),
  cacheProject: (projectData) => ipcRenderer.invoke('project:cacheProject', projectData),
  getCachedProjects: () => ipcRenderer.invoke('project:getCachedProjects'),
  removeCachedProject: (projectRootPath) => ipcRenderer.invoke('project:removeCachedProject', projectRootPath),
  listProjectDocuments: (projectRootPath) => ipcRenderer.invoke('project:listProjectDocuments', projectRootPath),
  getProjectCurriculumOverview: (projectRootPath) => ipcRenderer.invoke('project:getCurriculumOverview', projectRootPath),
  loadCachedProject: (projectRootPath) => ipcRenderer.invoke('project:loadCachedProject', projectRootPath),
  openFolder: (folderPath) => ipcRenderer.invoke('system:openFolder', folderPath),
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
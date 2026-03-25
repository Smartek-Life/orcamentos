import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('desktopApi', {
  exportProjectPdf: (payload) => ipcRenderer.invoke('project:export-pdf', payload),
  loadProjectState: (projectKey) => ipcRenderer.invoke('project:load-state', { projectKey }),
  saveProjectState: (state) => ipcRenderer.invoke('project:save-state', { state }),
  clearProjectState: (projectKey) => ipcRenderer.invoke('project:clear-state', { projectKey }),
});

import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  platform: process.platform,
  saveVida: (data: unknown) => ipcRenderer.invoke('vida:save', data),
  loadVida: () => ipcRenderer.invoke('vida:load'),
  clearVida: () => ipcRenderer.invoke('vida:clear'),
  getVersion: () => ipcRenderer.invoke('vida:version'),
  minimizeVida: () => ipcRenderer.invoke('vida:minimize'),
  setSidebar: (visible: boolean) => ipcRenderer.invoke('vida:setSidebar', visible),
  quitVida: () => ipcRenderer.invoke('vida:quit')
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pullscope', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  disconnect: () => ipcRenderer.invoke('settings:disconnect'),
  getCachedData: () => ipcRenderer.invoke('cache:get'),
  sync: () => ipcRenderer.invoke('bitbucket:sync'),
  getBrowsers: () => ipcRenderer.invoke('browser:list'),
  setBrowser: (browser) => ipcRenderer.invoke('browser:set', browser),
  getLocalRepositories: () => ipcRenderer.invoke('local-repositories:list'),
  addLocalRepository: () => ipcRenderer.invoke('local-repositories:add'),
  removeLocalRepository: (id) => ipcRenderer.invoke('local-repositories:remove', id),
  refreshLocalRepositories: () => ipcRenderer.invoke('local-repositories:refresh'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
})

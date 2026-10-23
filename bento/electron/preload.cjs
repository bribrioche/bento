const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hub', {
  listCatalog: () => ipcRenderer.invoke('catalog:list'),
  selectWorkspace: () => ipcRenderer.invoke('workspace:select'),
  installCatalogApp: (id) => ipcRenderer.invoke('catalog:install', id),
  launchCatalogApp: (id) => ipcRenderer.invoke('catalog:launch', id),
  listApps: () => ipcRenderer.invoke('apps:list'),
  addApp: () => ipcRenderer.invoke('apps:add'),
  updateApp: (id, name, description) => ipcRenderer.invoke('apps:update', { id, name, description }),
  removeApp: (id) => ipcRenderer.invoke('apps:remove', id),
  refreshIcon: (id) => ipcRenderer.invoke('apps:refresh-icon', id),
  launchApp: (id) => ipcRenderer.invoke('apps:launch', id),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
})

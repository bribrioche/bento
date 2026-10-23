const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('agentLauncher', {
  listFolders:()=>ipcRenderer.invoke('folders:list'),
  addFolder:()=>ipcRenderer.invoke('folders:add'),
  updateFolder:(id,name,description)=>ipcRenderer.invoke('folders:update',{id,name,description}),
  removeFolder:(id)=>ipcRenderer.invoke('folders:remove',id),
  launch:(id,agent)=>ipcRenderer.invoke('agent:launch',{id,agent}),
  getTerminals:()=>ipcRenderer.invoke('terminal:list'),
  setTerminal:(terminal)=>ipcRenderer.invoke('terminal:set',terminal),
  pickTerminalApp:()=>ipcRenderer.invoke('terminal:pick'),
  addTerminalApp:(input)=>ipcRenderer.invoke('terminal:add',input),
  removeTerminalApp:(id)=>ipcRenderer.invoke('terminal:remove',id),
  setTheme:(theme)=>ipcRenderer.invoke('theme:set',theme),
})

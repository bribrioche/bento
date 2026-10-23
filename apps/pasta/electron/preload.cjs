const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pasta", {
  listNotes: () => ipcRenderer.invoke("notes:list"),
  createNote: (note) => ipcRenderer.invoke("notes:create", note),
  updateNote: (id, note) => ipcRenderer.invoke("notes:update", id, note),
  removeNote: (id) => ipcRenderer.invoke("notes:remove", id),
  copyText: (value) => ipcRenderer.invoke("clipboard:copy", value),
  setTheme: (theme) => ipcRenderer.invoke("window:set-theme", theme),
});

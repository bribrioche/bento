const { contextBridge, ipcRenderer, webUtils } = require('electron')

const droppedFileListeners = new Set()

window.addEventListener('dragover', (event) => event.preventDefault())
window.addEventListener('drop', async (event) => {
  event.preventDefault()
  const filePaths = Array.from(event.dataTransfer?.files || [])
    .map((file) => webUtils.getPathForFile(file))
    .filter((filePath) => /\.(md|markdown|mdown|mkd)$/i.test(filePath))
  if (filePaths.length === 0) return

  try {
    const documents = await ipcRenderer.invoke('file:open-dropped', filePaths)
    droppedFileListeners.forEach((listener) => listener(documents))
  } catch (error) {
    ipcRenderer.send('file:drop-error', error instanceof Error ? error.message : 'The dropped file could not be opened.')
  }
})

contextBridge.exposeInMainWorld('lumen', {
  chooseFile: () => ipcRenderer.invoke('file:choose'),
  openRecent: (filePath) => ipcRenderer.invoke('file:open-recent', filePath),
  reloadDocument: (filePath) => ipcRenderer.invoke('file:reload', filePath),
  saveDocument: (filePath, content) => ipcRenderer.invoke('file:save-content', filePath, content),
  listRecents: () => ipcRenderer.invoke('recent:list'),
  removeRecent: (filePath) => ipcRenderer.invoke('recent:remove', filePath),
  clearRecents: () => ipcRenderer.invoke('recent:clear'),
  showInFolder: (filePath) => ipcRenderer.invoke('path:show', filePath),
  openExternal: (url) => ipcRenderer.invoke('link:open', url),
  onFileOpened: (callback) => {
    const handler = (_event, document) => callback(document)
    ipcRenderer.on('file:opened', handler)
    return () => ipcRenderer.removeListener('file:opened', handler)
  },
  onFilesDropped: (callback) => {
    droppedFileListeners.add(callback)
    return () => droppedFileListeners.delete(callback)
  },
  onFileError: (callback) => {
    const handler = (_event, message) => callback(message)
    ipcRenderer.on('file:error', handler)
    return () => ipcRenderer.removeListener('file:error', handler)
  },
})

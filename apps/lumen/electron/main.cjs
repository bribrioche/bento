const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const MAX_RECENT = 12
const markdownExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd'])
const authorizedFiles = new Set()
let mainWindow
let queuedFile = null

function recentFilePath() {
  return path.join(app.getPath('userData'), 'recent-files.json')
}

async function getRecents() {
  try {
    const data = JSON.parse(await fs.readFile(recentFilePath(), 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function saveRecents(recents) {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(recentFilePath(), JSON.stringify(recents.slice(0, MAX_RECENT), null, 2), 'utf8')
}

async function readMarkdown(filePath, addToRecent = true) {
  if (!filePath || !markdownExtensions.has(path.extname(filePath).toLowerCase())) {
    throw new Error('Please choose a Markdown file.')
  }

  const [content, stats] = await Promise.all([
    fs.readFile(filePath, 'utf8'),
    fs.stat(filePath),
  ])

  const document = {
    path: filePath,
    name: path.basename(filePath),
    content,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    openedAt: new Date().toISOString(),
  }

  authorizedFiles.add(path.resolve(filePath))

  if (addToRecent) {
    const recents = await getRecents()
    const next = [
      { path: document.path, name: document.name, size: document.size, modifiedAt: document.modifiedAt, openedAt: document.openedAt },
      ...recents.filter((item) => item.path !== filePath),
    ]
    await saveRecents(next)
  }

  return document
}

async function openFile(filePath) {
  try {
    const document = await readMarkdown(filePath)
    mainWindow?.webContents.send('file:opened', document)
  } catch (error) {
    mainWindow?.webContents.send('file:error', error.message)
  }
}

function findMarkdownArgument(argv) {
  return argv.find((arg) => markdownExtensions.has(path.extname(arg).toLowerCase()))
}

function createWindow() {
  const windowIcon = app.isPackaged
    ? path.join(__dirname, '..', 'dist', 'topBarIcon.png')
    : path.join(__dirname, '..', 'public', 'topBarIcon.png')

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 840,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7f6f3',
    icon: windowIcon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (queuedFile) {
      openFile(queuedFile)
      queuedFile = null
    }
  })
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = findMarkdownArgument(argv)
    if (filePath) openFile(filePath)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (mainWindow) openFile(filePath)
    else queuedFile = filePath
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    queuedFile = findMarkdownArgument(process.argv)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('file:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open a Markdown file',
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return readMarkdown(result.filePaths[0])
})

ipcMain.handle('file:open-recent', async (_event, filePath) => readMarkdown(filePath))
ipcMain.handle('file:open-dropped', async (_event, filePaths) => {
  if (!Array.isArray(filePaths)) return []
  const uniquePaths = [...new Set(filePaths.filter((filePath) => typeof filePath === 'string'))]
  return Promise.all(uniquePaths.map((filePath) => readMarkdown(filePath)))
})
ipcMain.on('file:drop-error', (event, message) => event.sender.send('file:error', message))
ipcMain.handle('file:reload', async (_event, filePath) => {
  const resolvedPath = path.resolve(filePath)
  if (!authorizedFiles.has(resolvedPath)) throw new Error('This file is not open in Lumen.')
  return readMarkdown(resolvedPath, false)
})
ipcMain.handle('file:save-content', async (_event, filePath, content) => {
  const resolvedPath = path.resolve(filePath)
  if (!authorizedFiles.has(resolvedPath) || !markdownExtensions.has(path.extname(resolvedPath).toLowerCase())) {
    throw new Error('This file is not open in Lumen.')
  }
  if (typeof content !== 'string') throw new Error('Invalid document content.')

  await fs.writeFile(resolvedPath, content, 'utf8')
  const stats = await fs.stat(resolvedPath)
  const saved = { size: stats.size, modifiedAt: stats.mtime.toISOString() }
  const recents = await getRecents()
  await saveRecents(recents.map((item) => item.path === filePath ? { ...item, ...saved } : item))
  return saved
})
ipcMain.handle('recent:list', async () => getRecents())
ipcMain.handle('recent:remove', async (_event, filePath) => {
  const recents = await getRecents()
  await saveRecents(recents.filter((item) => item.path !== filePath))
  return getRecents()
})
ipcMain.handle('recent:clear', async () => {
  await saveRecents([])
  return []
})
ipcMain.handle('path:show', (_event, filePath) => shell.showItemInFolder(filePath))
ipcMain.handle('link:open', (_event, url) => {
  if (/^https?:\/\//i.test(url)) return shell.openExternal(url)
})

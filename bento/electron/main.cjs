const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs/promises')
const crypto = require('crypto')
const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
let mainWindow

const catalog = [
  { id: 'lumen', name: 'Lumen', registryName: 'Lumen Markdown', version: '1.0.1', category: 'Writing', description: 'A clean, focused Markdown reader for your notes and documents.', executable: 'Lumen Markdown.exe', installFolders: ['Lumen Markdown', 'lumen-markdown'], projectFolder: 'lumen', installerPrefix: 'Lumen Markdown Setup ', icon: './catalog/lumen.png' },
  { id: 'pasta', name: 'Pasta', registryName: 'Pasta', version: '1.2.1', category: 'Productivity', description: 'Keep snippets and everyday notes close at hand.', executable: 'Pasta.exe', installFolders: ['Pasta', 'pasta'], projectFolder: 'pasta', installerPrefix: 'Pasta Setup ', icon: './catalog/pasta.png' },
  { id: 'agent-launcher', name: 'Agent Launcher', registryName: 'Agent Launcher', version: '1.2.0', category: 'Developer tools', description: 'Start your coding agents in the right project, without the setup ritual.', executable: 'Agent Launcher.exe', installFolders: ['Agent Launcher', 'agent-launcher'], projectFolder: 'agent-launcher', installerPrefix: 'Agent Launcher Setup ', icon: './catalog/agent-launcher.png' },
  { id: 'pullscope', name: 'Pullscope', registryName: 'Pullscope', version: '1.4.2', category: 'Developer tools', description: 'Review pull requests with a sharp, distraction-free overview.', executable: 'Pullscope.exe', installFolders: ['Pullscope', 'pullscope'], projectFolder: 'pullscope', installerPrefix: 'Pullscope Setup ', icon: './catalog/pullscope.png' },
]

function libraryPath() { return path.join(app.getPath('userData'), 'apps.json') }
function workspacePreferencePath() { return path.join(app.getPath('userData'), 'workspace.json') }
async function pathExists(candidate) { try { await fs.access(candidate); return true } catch { return false } }
async function readLibrary() { try { return JSON.parse(await fs.readFile(libraryPath(), 'utf8')) } catch { return [] } }
async function writeLibrary(apps) {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(libraryPath(), JSON.stringify(apps, null, 2), 'utf8')
  return apps
}
async function extractAppIcon(targetPath) {
  try { const icon = await app.getFileIcon(targetPath, { size: 'large' }); return icon.isEmpty() ? '' : icon.toDataURL() } catch { return '' }
}
async function refreshLibraryIcons(apps) {
  let changed = false
  const refreshed = await Promise.all(apps.map(async (item) => {
    const icon = await extractAppIcon(item.path)
    if (!icon || icon === item.icon) return item
    changed = true
    return { ...item, icon }
  }))
  if (changed) await writeLibrary(refreshed)
  return refreshed
}
function titleBarColors(theme) {
  return theme === 'dark' ? { color: '#17191d', symbolColor: '#8d95a3', height: 44 } : { color: '#f6f5f1', symbolColor: '#697180', height: 44 }
}
async function workspaceAt(candidate) {
  return Boolean(candidate && await pathExists(path.join(candidate, 'bento-workspace.json')))
}
async function findMarkerUpward(start) {
  let current = path.resolve(start)
  for (let depth = 0; depth < 8; depth += 1) {
    if (await workspaceAt(current)) return current
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return ''
}
async function findWorkspaceRoot() {
  try {
    const preference = JSON.parse(await fs.readFile(workspacePreferencePath(), 'utf8'))
    if (await workspaceAt(preference.path)) return preference.path
  } catch { /* No saved workspace yet. */ }

  const starts = [process.cwd(), __dirname, path.dirname(process.execPath)]
  for (const start of starts) {
    const found = await findMarkerUpward(start)
    if (found) return found
  }
  return ''
}
async function selectWorkspace() {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Select your Bento workspace', properties: ['openDirectory'] })
  if (result.canceled || !result.filePaths[0]) return null
  const selected = path.resolve(result.filePaths[0])
  let workspace = await findMarkerUpward(selected)
  if (!workspace && await workspaceAt(path.join(selected, 'Bento'))) workspace = path.join(selected, 'Bento')
  if (!workspace) throw new Error('This folder is not a Bento workspace. Select the folder containing bento-workspace.json.')
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(workspacePreferencePath(), JSON.stringify({ path: workspace }, null, 2), 'utf8')
  return getCatalog()
}
async function sourceProjectPath(item) {
  const workspace = await findWorkspaceRoot()
  return workspace ? path.join(workspace, 'apps', item.projectFolder) : ''
}
async function installerPath(item) {
  const bundled = path.join(process.resourcesPath, 'installers', item.id, 'setup.exe')
  if (app.isPackaged && await pathExists(bundled)) return bundled
  const project = await sourceProjectPath(item)
  if (!project) return ''
  const release = path.join(project, 'release')
  try {
    const candidates = await Promise.all((await fs.readdir(release))
      .filter((name) => name.startsWith(item.installerPrefix) && name.endsWith('.exe'))
      .map(async (name) => ({ path: path.join(release, name), modified: (await fs.stat(path.join(release, name))).mtimeMs })))
    return candidates.sort((a, b) => b.modified - a.modified)[0]?.path || ''
  } catch { return '' }
}
async function buildInstaller(item) {
  const project = await sourceProjectPath(item)
  if (!project || !await pathExists(path.join(project, 'package.json'))) throw new Error(`The source project for ${item.name} is unavailable.`)
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  if (!await pathExists(path.join(project, 'node_modules'))) {
    await execFileAsync(npm, ['ci'], { cwd: project, windowsHide: true, timeout: 15 * 60_000, maxBuffer: 20 * 1024 * 1024 })
  }
  await execFileAsync(npm, ['run', 'dist'], { cwd: project, windowsHide: true, timeout: 25 * 60_000, maxBuffer: 30 * 1024 * 1024 })
  const setup = await installerPath(item)
  if (!setup) throw new Error(`${item.name} finished building, but Bento could not find its installer.`)
  return setup
}
async function installedPath(item) {
  const roots = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs'), process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean)
  for (const root of roots) {
    for (const folder of item.installFolders) {
      const candidate = path.join(root, folder, item.executable)
      if (await pathExists(candidate)) return candidate
    }
  }
  if (process.platform === 'win32') {
    try {
      const registryScript = `param([string]$TargetName)
$keys = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')
$entry = Get-ItemProperty -Path $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $TargetName } | Select-Object -First 1 DisplayIcon,InstallLocation
if ($entry) { $entry | ConvertTo-Json -Compress }`
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', registryScript, '-TargetName', item.registryName], { windowsHide: true, timeout: 5000 })
      if (stdout.trim()) {
        const entry = JSON.parse(stdout.trim())
        const iconPath = String(entry.DisplayIcon || '').replace(/^"|"$|,\d+$/g, '')
        if (iconPath && await pathExists(iconPath)) return iconPath
        const locationPath = entry.InstallLocation ? path.join(entry.InstallLocation, item.executable) : ''
        if (locationPath && await pathExists(locationPath)) return locationPath
      }
    } catch { /* The standard paths and saved library remain valid fallbacks. */ }
  }
  const saved = (await readLibrary()).find((entry) => path.basename(entry.path).toLowerCase() === item.executable.toLowerCase())
  return saved && await pathExists(saved.path) ? saved.path : ''
}
async function getCatalog() {
  return Promise.all(catalog.map(async (item) => {
    const project = await sourceProjectPath(item)
    const setup = await installerPath(item)
    return {
      id: item.id, name: item.name, version: item.version, category: item.category, description: item.description, icon: item.icon,
      installed: Boolean(await installedPath(item)), installerAvailable: Boolean(setup && await pathExists(setup)),
      sourceAvailable: Boolean(project && await pathExists(path.join(project, 'package.json'))),
    }
  }))
}
async function focusExistingApp(targetPath) {
  if (process.platform !== 'win32') return false
  try {
    const script = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'focus-existing.ps1') : path.join(__dirname, 'focus-existing.ps1')
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-TargetPath', targetPath], { windowsHide: true, timeout: 5000 })
    return stdout.trim().includes('FOCUSED')
  } catch { return false }
}
async function launchPath(targetPath) {
  const focused = await focusExistingApp(targetPath)
  if (!focused) { const error = await shell.openPath(targetPath); if (error) throw new Error(error) }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180, height: 780, minWidth: 820, minHeight: 600,
    backgroundColor: '#f7f6f2', icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    titleBarStyle: 'hidden', titleBarOverlay: titleBarColors('light'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  if (isDev) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('catalog:list', getCatalog)
  ipcMain.handle('workspace:select', selectWorkspace)
  ipcMain.handle('catalog:install', async (_event, id) => {
    const item = catalog.find((entry) => entry.id === id)
    if (!item) throw new Error('This app is not in the Bento catalog.')
    let setup = await installerPath(item)
    if (!setup || !await pathExists(setup)) setup = await buildInstaller(item)
    await new Promise((resolve, reject) => {
      const child = execFile(setup, [], { windowsHide: false }, (error) => error ? reject(error) : resolve())
      child.on('error', reject)
    })
    return getCatalog()
  })
  ipcMain.handle('catalog:launch', async (_event, id) => {
    const item = catalog.find((entry) => entry.id === id)
    if (!item) throw new Error('This app is not in the Bento catalog.')
    const target = await installedPath(item)
    if (!target) throw new Error(`${item.name} does not appear to be installed yet.`)
    await launchPath(target)
    return true
  })
  ipcMain.handle('apps:list', async () => refreshLibraryIcons(await readLibrary()))
  ipcMain.handle('apps:add', async () => {
    const filters = process.platform === 'win32' ? [{ name: 'Applications', extensions: ['exe', 'lnk'] }] : [{ name: 'Applications', extensions: ['app', 'AppImage', 'desktop'] }]
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Add an app to Bento', properties: ['openFile'], filters })
    if (result.canceled || !result.filePaths[0]) return null
    const selectedPath = path.resolve(result.filePaths[0])
    const apps = await readLibrary()
    const existing = apps.find((item) => path.resolve(item.path).toLowerCase() === selectedPath.toLowerCase())
    if (existing) return existing
    const entry = { id: crypto.randomUUID(), name: path.basename(selectedPath, path.extname(selectedPath)), description: '', path: selectedPath, icon: await extractAppIcon(selectedPath), addedAt: new Date().toISOString(), launchCount: 0 }
    await writeLibrary([...apps, entry])
    return entry
  })
  ipcMain.handle('apps:update', async (_event, input) => {
    const name = String(input.name || '').trim().slice(0, 80)
    const description = String(input.description || '').trim().slice(0, 240)
    if (!name) throw new Error('App name cannot be empty.')
    const apps = await readLibrary()
    const index = apps.findIndex((item) => item.id === input.id)
    if (index < 0) throw new Error('This app is no longer in Bento.')
    apps[index] = { ...apps[index], name, description }
    return writeLibrary(apps)
  })
  ipcMain.handle('apps:remove', async (_event, id) => writeLibrary((await readLibrary()).filter((item) => item.id !== id)))
  ipcMain.handle('apps:refresh-icon', async (_event, id) => {
    const apps = await readLibrary(); const index = apps.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('This app is no longer in Bento.')
    const icon = await extractAppIcon(apps[index].path)
    if (!icon) throw new Error('Windows could not retrieve an icon from this application.')
    apps[index] = { ...apps[index], icon }
    return writeLibrary(apps)
  })
  ipcMain.handle('apps:launch', async (_event, id) => {
    const apps = await readLibrary(); const index = apps.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('This app is no longer in Bento.')
    await launchPath(apps[index].path)
    apps[index] = { ...apps[index], lastLaunchedAt: new Date().toISOString(), launchCount: (apps[index].launchCount || 0) + 1 }
    return writeLibrary(apps)
  })
  ipcMain.handle('theme:set', (_event, theme) => {
    const value = theme === 'dark' ? 'dark' : 'light'
    if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.setTitleBarOverlay(titleBarColors(value)); mainWindow.setBackgroundColor(value === 'dark' ? '#121417' : '#f7f6f2') }
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

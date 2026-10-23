const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron')
const { spawn } = require('child_process')
const { execFile } = require('child_process')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs/promises')
const crypto = require('crypto')

const API_ROOT = 'https://api.bitbucket.org/2.0'
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const execFileAsync = promisify(execFile)

function dataPath(name) {
  return path.join(app.getPath('userData'), name)
}

async function readJson(name, fallback = null) {
  try { return JSON.parse(await fs.readFile(dataPath(name), 'utf8')) } catch { return fallback }
}

async function writeJson(name, value) {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(dataPath(name), JSON.stringify(value, null, 2), 'utf8')
}

function encryptToken(token) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable on this system.')
  return safeStorage.encryptString(token).toString('base64')
}

function decryptToken(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return ''
  try { return safeStorage.decryptString(Buffer.from(value, 'base64')) } catch { return '' }
}

async function getPrivateSettings() {
  return readJson('settings.json', { workspace: '', email: '', encryptedToken: '' })
}

function publicSettings(settings) {
  return { workspace: settings.workspace || '', email: settings.email || '', hasToken: Boolean(settings.encryptedToken), browser: settings.browser || 'default' }
}

function repositorySlugFromRemote(remote, directory) {
  const normalized = String(remote || '').trim().replace(/\\/g, '/')
  const match = normalized.match(/bitbucket\.org[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i)
  return (match?.[2] || path.basename(directory)).replace(/\.git$/i, '').toLowerCase()
}

async function scanLocalRepository(entry) {
  try {
    const [remoteResult, branchResult] = await Promise.all([
      execFileAsync('git', ['-C', entry.path, 'remote', 'get-url', 'origin'], { windowsHide: true }),
      execFileAsync('git', ['-C', entry.path, 'for-each-ref', '--format=%(refname:short)', 'refs/heads'], { windowsHide: true }),
    ])
    let defaultBranch = ''
    try {
      const defaultResult = await execFileAsync('git', ['-C', entry.path, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { windowsHide: true })
      defaultBranch = defaultResult.stdout.trim().replace(/^origin\//, '')
    } catch {}
    return { ...entry, name: path.basename(entry.path), repositorySlug: repositorySlugFromRemote(remoteResult.stdout, entry.path), branches: branchResult.stdout.split(/\r?\n/).filter(Boolean), defaultBranch, error: '' }
  } catch (error) {
    return { ...entry, name: path.basename(entry.path), repositorySlug: path.basename(entry.path).toLowerCase(), branches: [], defaultBranch: '', error: error.code === 'ENOENT' ? 'Git is not installed or is not available in PATH.' : 'This folder is not a readable Git repository.' }
  }
}

async function localRepositoryResult(settings) {
  const entries = Array.isArray(settings.localRepositories) ? settings.localRepositories : []
  return Promise.all(entries.map(scanLocalRepository))
}

function browserCandidates() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const localAppData = process.env.LOCALAPPDATA || ''
  return [
    { id: 'edge', name: 'Microsoft Edge', paths: [path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')] },
    { id: 'chrome', name: 'Google Chrome', paths: [path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')] },
    { id: 'firefox', name: 'Mozilla Firefox', paths: [path.join(programFiles, 'Mozilla Firefox', 'firefox.exe'), path.join(programFilesX86, 'Mozilla Firefox', 'firefox.exe')] },
    { id: 'brave', name: 'Brave', paths: [path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'), path.join(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'), path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')] },
  ]
}

async function availableBrowsers() {
  const browsers = [{ id: 'default', name: 'System default' }]
  for (const browser of browserCandidates()) {
    for (const candidate of browser.paths) {
      try { await fs.access(candidate); browsers.push({ id: browser.id, name: browser.name }); break } catch {}
    }
  }
  return browsers
}

async function browserExecutable(id) {
  const browser = browserCandidates().find((item) => item.id === id)
  if (!browser) return ''
  for (const candidate of browser.paths) {
    try { await fs.access(candidate); return candidate } catch {}
  }
  return ''
}

async function apiFetch(url, authorization, requestName = 'request') {
  const response = await fetch(url, { headers: { Authorization: authorization, Accept: 'application/json' } })
  if (!response.ok) {
    let detail = ''
    try {
      const payload = await response.json()
      detail = payload?.error?.message || payload?.error?.detail || payload?.message || ''
    } catch {}
    if (response.status === 401) throw new Error('Bitbucket rejected this API token. Check that it is valid and has not expired.')
    if (response.status === 403) {
      const scopeHint = requestName === 'access to your account profile'
        ? ' Create a new API token with User data: Read (read:user:bitbucket).'
        : ''
      throw new Error(`Bitbucket denied ${requestName} (403).${detail ? ` ${detail}` : ''}${scopeHint}`)
    }
    if (response.status === 404) throw new Error(`Bitbucket could not find ${requestName} (404). Check the workspace slug.`)
    throw new Error(detail || `Bitbucket ${requestName} failed (${response.status}).`)
  }
  return response.json()
}

async function allPages(initialUrl, authorization, requestName = 'request') {
  const values = []
  let next = initialUrl
  while (next) {
    const page = await apiFetch(next, authorization, requestName)
    values.push(...(page.values || []))
    next = page.next || ''
  }
  return values
}

function mapPullRequest(pr, repoName) {
  const participants = pr.participants || []
  const reviewState = (person) => String(person.state || person.status || '').toLowerCase().replace(/[\s-]+/g, '_')
  const isDraft = Boolean(pr.draft) || /^\s*(draft|wip)\s*[:\-]/i.test(pr.title || '')
  const state = String(pr.state || '').toUpperCase()
  return {
    key: `${pr.destination?.repository?.full_name || repoName}#${pr.id}`,
    id: pr.id,
    title: pr.title || `Pull request #${pr.id}`,
    url: pr.links?.html?.href || '',
    status: state === 'MERGED' ? 'MERGED' : isDraft ? 'DRAFT' : 'OPEN',
    sourceState: state,
    createdOn: pr.created_on,
    updatedOn: pr.updated_on,
    commentCount: pr.comment_count || 0,
    approvals: participants.filter((person) => person.approved === true || reviewState(person) === 'approved').length,
    changesRequested: participants.filter((person) => ['changes_requested', 'needs_work'].includes(reviewState(person))).length,
    repository: pr.destination?.repository?.name || repoName,
    repositorySlug: pr.destination?.repository?.full_name?.split('/').pop()?.toLowerCase() || String(repoName).toLowerCase(),
    sourceBranch: pr.source?.branch?.name || '',
    destinationBranch: pr.destination?.branch?.name || '',
    authorName: pr.author?.display_name || '',
    authorAvatar: pr.author?.links?.avatar?.href || '',
  }
}

async function hydratePullRequestReviews(items, settings, repo, authorization) {
  return mapLimit(items, 4, async (pr) => {
    if (Array.isArray(pr.participants) && pr.participants.length > 0) return pr
    try {
      const detailUrl = `${API_ROOT}/repositories/${encodeURIComponent(settings.workspace)}/${encodeURIComponent(repo.slug)}/pullrequests/${encodeURIComponent(pr.id)}?fields=participants,reviewers`
      const detail = await apiFetch(detailUrl, authorization, `review details for pull request #${pr.id}`)
      return { ...pr, participants: detail.participants || pr.participants || [], reviewers: detail.reviewers || pr.reviewers || [] }
    } catch { return pr }
  })
}

function mapBranch(branch, repo) {
  return {
    key: `${repo.full_name}:${branch.name}`,
    name: branch.name,
    repository: repo.name,
    url: branch.links?.html?.href || `https://bitbucket.org/${repo.full_name}/branch/${encodeURIComponent(branch.name)}`,
    updatedOn: branch.target?.date || repo.updated_on || '',
    authorName: branch.target?.author?.user?.display_name || branch.target?.author?.raw || 'Unknown',
    commitHash: branch.target?.hash?.slice(0, 7) || '',
  }
}

async function mapLimit(items, limit, operation) {
  const output = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      output[index] = await operation(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return output
}

async function syncPullRequests() {
  const settings = await getPrivateSettings()
  const token = decryptToken(settings.encryptedToken)
  if (!settings.workspace || !token) throw new Error('Add your Bitbucket connection before syncing.')

  const authorization = `Bearer ${token}`
  const user = await apiFetch(`${API_ROOT}/user`, authorization, 'access to your account profile')
  const reposUrl = `${API_ROOT}/repositories/${encodeURIComponent(settings.workspace)}?pagelen=100`
  const repositories = await allPages(reposUrl, authorization, `repositories in workspace “${settings.workspace}”`)
  const warnings = []

  const results = await mapLimit(repositories, 5, async (repo) => {
    const query = encodeURIComponent(`author.uuid=\"${user.uuid}\"`)
    const base = `${API_ROOT}/repositories/${encodeURIComponent(settings.workspace)}/${encodeURIComponent(repo.slug)}/pullrequests?pagelen=50&q=${query}`
    const openBase = `${API_ROOT}/repositories/${encodeURIComponent(settings.workspace)}/${encodeURIComponent(repo.slug)}/pullrequests?pagelen=50&state=OPEN`
    const branchesUrl = `${API_ROOT}/repositories/${encodeURIComponent(settings.workspace)}/${encodeURIComponent(repo.slug)}/refs/branches?pagelen=100`
    try {
      const [allOpen, mergedResults, declinedResults, branches] = await Promise.all([
        allPages(openBase, authorization, `open pull requests in “${repo.name}”`),
        allPages(`${base}&state=MERGED`, authorization, `merged pull requests in “${repo.name}”`),
        allPages(`${base}&state=DECLINED`, authorization, `declined pull request references in “${repo.name}”`),
        allPages(branchesUrl, authorization, `branches in “${repo.name}”`),
      ])
      const open = allOpen.filter((pr) => String(pr.state).toUpperCase() === 'OPEN' && pr.author?.uuid === user.uuid)
      const merged = mergedResults.filter((pr) => String(pr.state).toUpperCase() === 'MERGED')
      const pullRequestsWithReviews = await hydratePullRequestReviews([...open, ...merged], settings, repo, authorization)
      const branchesWithOpenPr = new Set(allOpen
        .filter((pr) => String(pr.state).toUpperCase() === 'OPEN' && pr.source?.repository?.uuid === repo.uuid)
        .map((pr) => pr.source?.branch?.name))
      const connectedPullRequestBranches = [...allOpen, ...mergedResults, ...declinedResults]
        .filter((pr) => pr.source?.repository?.uuid === repo.uuid)
        .map((pr) => `${repo.slug}:${pr.source?.branch?.name}`.toLowerCase())
      const withoutPr = branches
        .filter((branch) => branch.name !== repo.mainbranch?.name && !branchesWithOpenPr.has(branch.name))
        .map((branch) => mapBranch(branch, repo))
      return { pullRequests: pullRequestsWithReviews.filter((pr) => ['OPEN', 'MERGED'].includes(String(pr.state).toUpperCase())).map((pr) => mapPullRequest(pr, repo.name)), branches: withoutPr, connectedPullRequestBranches }
    } catch (error) {
      warnings.push(`${repo.name}: ${error.message}`)
      return { pullRequests: [], branches: [], connectedPullRequestBranches: [] }
    }
  })

  const uniquePullRequests = new Map()
  for (const pr of results.flatMap((result) => result.pullRequests)) {
    if (['OPEN', 'MERGED'].includes(pr.sourceState) && (pr.status === 'OPEN' || pr.status === 'DRAFT' || pr.status === 'MERGED')) uniquePullRequests.set(pr.key, pr)
  }
  const pullRequests = [...uniquePullRequests.values()].sort((a, b) => new Date(b.updatedOn) - new Date(a.updatedOn))
  const branchesWithoutPr = results.flatMap((result) => result.branches).sort((a, b) => new Date(b.updatedOn) - new Date(a.updatedOn))
  const connectedPullRequestBranches = [...new Set(results.flatMap((result) => result.connectedPullRequestBranches || []))]
  const data = { schemaVersion: 7, pullRequests, branchesWithoutPr, connectedPullRequestBranches, syncedAt: new Date().toISOString(), repositoryCount: repositories.length, warnings }
  await writeJson('cache.json', data)
  return data
}

let mainWindow

function titleBarColors(theme) {
  return theme === 'dark'
    ? { color: '#191c21', symbolColor: '#7f8794', height: 44 }
    : { color: '#f0f2f5', symbolColor: '#6b7280', height: 44 }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f7f8fa',
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    titleBarOverlay: titleBarColors('light'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  mainWindow = win
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('settings:get', async () => publicSettings(await getPrivateSettings()))
  ipcMain.handle('settings:save', async (_event, input) => {
    const workspace = String(input.workspace || '').trim()
    const email = String(input.email || '').trim()
    const token = String(input.token || '').trim()
    if (!workspace) throw new Error('Workspace is required.')
    const previous = await getPrivateSettings()
    const encryptedToken = token ? encryptToken(token) : previous.encryptedToken
    if (!encryptedToken) throw new Error('API token is required.')
    const settings = { ...previous, workspace, email, encryptedToken }
    await writeJson('settings.json', settings)
    return publicSettings(settings)
  })
  ipcMain.handle('settings:disconnect', async () => {
    const previous = await getPrivateSettings()
    await Promise.all([writeJson('settings.json', { browser: previous.browser || 'default', localRepositories: previous.localRepositories || [], workspace: '', email: '', encryptedToken: '' }), fs.rm(dataPath('cache.json'), { force: true })])
  })
  ipcMain.handle('cache:get', async () => {
    const cached = await readJson('cache.json', null)
    if (!cached || cached.schemaVersion !== 7) return null
    const unique = new Map((cached.pullRequests || []).map((pr) => [pr.key, pr]))
    return { ...cached, pullRequests: [...unique.values()].filter((pr) => ['OPEN', 'MERGED'].includes(pr.sourceState)), branchesWithoutPr: cached.branchesWithoutPr || [] }
  })
  ipcMain.handle('browser:list', async () => {
    const settings = await getPrivateSettings(); const browsers = await availableBrowsers()
    return { selected: browsers.some((item) => item.id === settings.browser) ? settings.browser : 'default', browsers }
  })
  ipcMain.handle('browser:set', async (_event, browser) => {
    const browsers = await availableBrowsers()
    if (!browsers.some((item) => item.id === browser)) throw new Error('That browser is not available.')
    const settings = { ...(await getPrivateSettings()), browser }; await writeJson('settings.json', settings)
    return browser
  })
  ipcMain.handle('local-repositories:list', async () => localRepositoryResult(await getPrivateSettings()))
  ipcMain.handle('local-repositories:add', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Add a local Git repository', properties: ['openDirectory'] })
    if (result.canceled || !result.filePaths[0]) return localRepositoryResult(await getPrivateSettings())
    const selected = path.resolve(result.filePaths[0]); const settings = await getPrivateSettings()
    const entries = Array.isArray(settings.localRepositories) ? settings.localRepositories : []
    if (!entries.some((item) => path.resolve(item.path).toLowerCase() === selected.toLowerCase())) entries.push({ id: crypto.randomUUID(), path: selected })
    const next = { ...settings, localRepositories: entries }; await writeJson('settings.json', next)
    return localRepositoryResult(next)
  })
  ipcMain.handle('local-repositories:remove', async (_event, id) => {
    const settings = await getPrivateSettings(); const entries = (settings.localRepositories || []).filter((item) => item.id !== id)
    const next = { ...settings, localRepositories: entries }; await writeJson('settings.json', next)
    return localRepositoryResult(next)
  })
  ipcMain.handle('local-repositories:refresh', async () => localRepositoryResult(await getPrivateSettings()))
  ipcMain.handle('bitbucket:sync', () => syncPullRequests())
  ipcMain.handle('theme:set', (_event, theme) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitleBarOverlay(titleBarColors(theme === 'dark' ? 'dark' : 'light'))
      mainWindow.setBackgroundColor(theme === 'dark' ? '#15171b' : '#f7f8fa')
    }
  })
  ipcMain.handle('external:open', async (_event, url) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'bitbucket.org') throw new Error('Only Bitbucket links can be opened.')
    const browser = (await getPrivateSettings()).browser || 'default'
    if (browser === 'default') return shell.openExternal(parsed.toString())
    const executable = await browserExecutable(browser)
    if (!executable) throw new Error('The selected browser is no longer installed. Choose another browser.')
    const child = spawn(executable, [parsed.toString()], { detached: true, stdio: 'ignore', windowsHide: false }); child.unref()
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

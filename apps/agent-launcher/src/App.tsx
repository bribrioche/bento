import { useEffect, useMemo, useState } from 'react'
import { Bot, Check, ChevronDown, Clock3, Code2, Folder, FolderPlus, MoreHorizontal, Moon, Pencil, Plus, Search, Sparkles, Sun, Terminal, TerminalSquare, Trash2 } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './components/ui/alert-dialog'

type Theme = 'light' | 'dark'
type Agent = 'claude' | 'codex'
function folderName(folder: ProjectFolder) {
  return folder.name || folder.path.split(/[\\/]/).filter(Boolean).at(-1) || folder.path
}

function App() {
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem('agent-launcher-theme') === 'dark' ? 'dark' : 'light')
  const [editing, setEditing] = useState<ProjectFolder | null>(null)
  const [removing, setRemoving] = useState<ProjectFolder | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [launched, setLaunched] = useState<string | null>(null)
  const [terminals, setTerminals] = useState<TerminalOption[]>([])
  const [terminal, setTerminal] = useState('windows-terminal')
  const [terminalDraft, setTerminalDraft] = useState<{name:string;path:string;args:string}|null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('agent-launcher-theme', theme)
    window.agentLauncher.setTheme(theme)
  }, [theme])

  useEffect(() => {
    window.agentLauncher.listFolders().then(setFolders).catch((reason) => setError(reason.message))
    window.agentLauncher.getTerminals().then((result) => { setTerminals(result.options); setTerminal(result.selected) }).catch((reason) => setError(reason.message))
  }, [])

  async function chooseTerminal(value: string) {
    setError('')
    try {
      const result = await window.agentLauncher.setTerminal(value)
      setTerminals(result.options); setTerminal(result.selected)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not change the terminal application.')
    }
  }

  async function pickTerminalApp() {
    setError('')
    try { setTerminalDraft(await window.agentLauncher.pickTerminalApp()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not select the terminal application.') }
  }

  async function addTerminalApp(event: React.FormEvent) {
    event.preventDefault(); if (!terminalDraft) return
    setError('')
    try {
      const result=await window.agentLauncher.addTerminalApp(terminalDraft)
      setTerminals(result.options);setTerminal(result.selected);setTerminalDraft(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not add the terminal application.') }
  }

  async function removeSelectedTerminal() {
    if (!terminal.startsWith('custom:')) return
    try { const result=await window.agentLauncher.removeTerminalApp(terminal);setTerminals(result.options);setTerminal(result.selected) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove the terminal application.') }
  }

  const visibleFolders = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return folders
    return folders.filter((folder) => `${folderName(folder)} ${folder.path} ${folder.description}`.toLowerCase().includes(needle))
  }, [folders, query])

  async function addFolder() {
    setError('')
    try {
      const folder = await window.agentLauncher.addFolder()
      if (!folder) return
      setFolders((current) => current.some((item) => item.id === folder.id) ? current : [folder, ...current])
      openEditor(folder)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add that folder.')
    }
  }

  function openEditor(folder: ProjectFolder) {
    setEditName(folderName(folder))
    setEditDescription(folder.description)
    setEditing(folder)
  }

  async function saveFolder(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    setError('')
    try {
      const next = await window.agentLauncher.updateFolder(editing.id, editName.trim(), editDescription.trim())
      setFolders(next)
      setEditing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the folder.')
    }
  }

  async function removeFolder() {
    if (!removing) return
    setError('')
    try {
      setFolders(await window.agentLauncher.removeFolder(removing.id))
      setRemoving(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove the folder.')
    }
  }

  async function launch(folder: ProjectFolder, agent: Agent) {
    const key = `${folder.id}:${agent}`
    setBusy(key)
    setError('')
    try {
      setFolders(await window.agentLauncher.launch(folder.id, agent))
      setLaunched(key)
      window.setTimeout(() => setLaunched((current) => current === key ? null : current), 1800)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not launch ${agent}.`)
    } finally {
      setBusy(null)
    }
  }

  return <div className="app-shell">
    <header className="titlebar">
      <div className="brand"><div className="brand-mark"><TerminalSquare size={18} /></div><span>Agent Launcher</span></div>
    </header>

    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow"><Sparkles size={14} /> Project command center</div>
          <h1>Start where your work lives.</h1>
          <p>Keep your project folders close and open Claude or Codex in the right terminal with one click.</p>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" size="icon" aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </Button>
          <Button onClick={addFolder}><FolderPlus size={17} /> Add folder</Button>
        </div>
      </section>

      {error && <div className="error-banner" role="alert">{error}<Button variant="ghost" size="sm" onClick={() => setError('')}>Dismiss</Button></div>}

      <section className="toolbar" aria-label="Folder tools">
        <div className="search-field"><Search size={17} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects..." aria-label="Search projects" /></div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="secondary" className="terminal-picker"><Terminal size={16} /><span>{terminals.find((item) => item.id === terminal)?.name || 'Windows Terminal'}</span><ChevronDown size={15} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent className="terminal-menu">
            {terminals.map((option) => <DropdownMenuItem key={option.id} onSelect={() => chooseTerminal(option.id)}>
              <span className="menu-check">{terminal === option.id && <Check size={14} />}</span>{option.name}
            </DropdownMenuItem>)}
            <DropdownMenuItem className="add-terminal-item" onSelect={pickTerminalApp}><Plus size={15} /> Add terminal application…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {terminal.startsWith('custom:') && <Button variant="ghost" size="icon" aria-label="Remove selected terminal application" onClick={removeSelectedTerminal}><Trash2 size={16} /></Button>}
        <span className="folder-count">{folders.length} {folders.length === 1 ? 'folder' : 'folders'}</span>
      </section>

      {visibleFolders.length ? <section className="folder-grid" aria-label="Project folders">
        {visibleFolders.map((folder) => <Card key={folder.id} className="folder-card">
          <div className="folder-card-head">
            <div className="folder-icon"><Folder size={21} /></div>
            <div className="folder-heading"><h2>{folderName(folder)}</h2><p title={folder.path}>{folder.path}</p></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Options for ${folderName(folder)}`}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => openEditor(folder)}><Pencil size={15} /> Edit details</DropdownMenuItem>
                <DropdownMenuItem className="danger-item" onSelect={() => setRemoving(folder)}><Trash2 size={15} /> Remove</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {folder.description ? <p className="folder-description">{folder.description}</p> : <p className="folder-description muted">No description yet.</p>}
          <div className="folder-meta">{folder.lastLaunchedAt ? <><Clock3 size={14} /> Last launched {new Date(folder.lastLaunchedAt).toLocaleString()}</> : <>Ready to launch</>}</div>
          <div className="launch-actions">
            <Button variant="secondary" onClick={() => launch(folder, 'claude')} disabled={busy !== null}>
              {launched === `${folder.id}:claude` ? <Check size={17} /> : <Bot size={17} />}
              {busy === `${folder.id}:claude` ? 'Opening...' : launched === `${folder.id}:claude` ? 'Opened' : 'Launch Claude'}
            </Button>
            <Button onClick={() => launch(folder, 'codex')} disabled={busy !== null}>
              {launched === `${folder.id}:codex` ? <Check size={17} /> : <Code2 size={17} />}
              {busy === `${folder.id}:codex` ? 'Opening...' : launched === `${folder.id}:codex` ? 'Opened' : 'Launch Codex'}
            </Button>
          </div>
        </Card>)}
      </section> : <Card className="empty-state">
        <div className="empty-icon"><FolderPlus size={25} /></div>
        <h2>{folders.length ? 'No matching projects' : 'Add your first project'}</h2>
        <p>{folders.length ? 'Try another search term.' : 'Choose a folder to launch your coding agents in the right place.'}</p>
        {!folders.length && <Button onClick={addFolder}><Plus size={17} /> Add folder</Button>}
      </Card>}
    </main>

    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
      <DialogContent>
        <div className="dialog-heading"><DialogTitle>Project details</DialogTitle><DialogDescription>Give this folder a friendly name and optional description.</DialogDescription></div>
        <form onSubmit={saveFolder} className="edit-form">
          <label>Display name<Input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="My project" required /></label>
          <label>Description<Textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="What are you building?" rows={3} /></label>
          <div className="path-preview"><Folder size={15} /><span>{editing?.path}</span></div>
          <div className="dialog-actions"><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit">Save changes</Button></div>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
      <AlertDialogContent>
        <AlertDialogTitle>Remove {removing ? folderName(removing) : 'folder'}?</AlertDialogTitle>
        <AlertDialogDescription>This only removes the shortcut from Agent Launcher. Files on disk will not be changed.</AlertDialogDescription>
        <div className="dialog-actions"><AlertDialogCancel asChild><Button variant="secondary">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="danger" onClick={removeFolder}>Remove folder</Button></AlertDialogAction></div>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={Boolean(terminalDraft)} onOpenChange={(open) => !open && setTerminalDraft(null)}>
      <DialogContent>
        <div className="dialog-heading"><DialogTitle>Add terminal application</DialogTitle><DialogDescription>Configure how this application receives the agent command. Keep <code>{'{command}'}</code> in the arguments.</DialogDescription></div>
        {terminalDraft && <form onSubmit={addTerminalApp} className="edit-form">
          <label>Display name<Input autoFocus value={terminalDraft.name} onChange={(event) => setTerminalDraft({...terminalDraft,name:event.target.value})} required /></label>
          <label>Executable<Input value={terminalDraft.path} readOnly /></label>
          <label>Launch arguments<Input value={terminalDraft.args} onChange={(event) => setTerminalDraft({...terminalDraft,args:event.target.value})} required /></label>
          <p className="argument-help">Available placeholders: <code>{'{command}'}</code> and <code>{'{cwd}'}</code>.</p>
          <div className="dialog-actions"><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit">Add application</Button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </div>
}

export default App

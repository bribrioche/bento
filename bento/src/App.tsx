import { useEffect, useMemo, useState } from 'react'
import { Check, Image, LayoutGrid, Library, LoaderCircle, Moon, MoreHorizontal, PackagePlus, Pencil, Plus, Search, Sun, Trash2, X } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Textarea } from './components/ui/textarea'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from './components/ui/alert-dialog'
import { Card } from './components/ui/card'

function relativeTime(value?: string) {
  if (!value) return 'Never opened'
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

function App() {
  const [catalog, setCatalog] = useState<CatalogApp[]>([])
  const [apps, setApps] = useState<HubApp[]>([])
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('hub-theme') as 'light' | 'dark') || 'light')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [launchingId, setLaunchingId] = useState('')
  const [editing, setEditing] = useState<HubApp | null>(null)
  const [deleting, setDeleting] = useState<HubApp | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([window.hub.listCatalog(), window.hub.listApps()])
      .then(([nextCatalog, nextApps]) => { setCatalog(nextCatalog); setApps(nextApps) })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Bento could not load your apps.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('hub-theme', theme)
    window.hub.setTheme(theme)
  }, [theme])

  const term = search.trim().toLowerCase()
  const visibleCatalog = useMemo(() => catalog.filter((item) => !term || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(term)), [catalog, term])
  const visibleApps = useMemo(() => apps.filter((item) => !term || `${item.name} ${item.description || ''} ${item.path}`.toLowerCase().includes(term)).sort((a, b) => a.name.localeCompare(b.name)), [apps, term])
  const installedCount = catalog.filter((item) => item.installed).length

  async function install(item: CatalogApp) {
    setWorkingId(item.id); setError('')
    try {
      const next = await window.hub.installCatalogApp(item.id)
      setCatalog(next)
      if (!next.find((entry) => entry.id === item.id)?.installed) setError(`${item.name} was not installed. You can try again whenever you’re ready.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not install ${item.name}.`) }
    finally { setWorkingId('') }
  }
  async function launchCatalog(item: CatalogApp) {
    setWorkingId(item.id); setError('')
    try { await window.hub.launchCatalogApp(item.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : `Could not open ${item.name}.`) }
    finally { setWorkingId('') }
  }
  async function addApp() {
    setAdding(true); setError('')
    try {
      const added = await window.hub.addApp()
      if (added) setApps((current) => current.some((item) => item.id === added.id) ? current : [...current, added])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add this app.') }
    finally { setAdding(false) }
  }
  async function launch(id: string) {
    setLaunchingId(id); setError('')
    try { setApps(await window.hub.launchApp(id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not launch this app.') }
    finally { setLaunchingId('') }
  }
  function openEdit(item: HubApp) { setEditing(item); setEditName(item.name); setEditDescription(item.description || '') }
  async function saveName(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    try { setApps(await window.hub.updateApp(editing.id, editName, editDescription)); setEditing(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this app.') }
  }
  async function remove() {
    if (!deleting) return
    try { setApps(await window.hub.removeApp(deleting.id)); setDeleting(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove this app.') }
  }
  async function refreshIcon(id: string) {
    setError('')
    try { setApps(await window.hub.refreshIcon(id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not refresh this icon.') }
  }

  return <div className="shell">
    <header className="titlebar"><div className="wordmark"><img className="brand-icon" src="./icon.png" alt="" /><span>Bento</span></div></header>
    <main>
      <section className="hero">
        <div><p className="eyebrow"><LayoutGrid size={13} /> Your app collection</p><h1>Pick what belongs<br />on your plate.</h1><p className="subtitle">Install the tools you want. Leave the rest for later.</p></div>
        <div className="hero-tools">
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</Button>
          <div className="search-box"><Search size={16} /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an app…" />{search && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></Button>}</div>
        </div>
      </section>

      {error && <div className="error-banner"><span>{error}</span><Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => setError('')}><X size={15} /></Button></div>}

      <section className="catalog-section">
        <div className="section-heading"><div><PackagePlus size={15} /><h2>Available in Bento</h2><span className="count">{installedCount}/{catalog.length} installed</span></div></div>
        {loading ? <div className="empty-state compact"><LoaderCircle className="spin" size={25} /><p>Setting the table…</p></div>
        : visibleCatalog.length === 0 ? <div className="empty-state compact"><h3>No catalog apps found</h3><p>Try a different search.</p></div>
        : <div className="catalog-grid">{visibleCatalog.map((item) => <Card className={`catalog-card ${item.installed ? 'is-installed' : ''}`} key={item.id}>
            <div className="catalog-top"><div className="catalog-icon"><img src={item.icon} alt="" /></div>{item.installed && <span className="installed-pill"><Check size={11} /> Installed</span>}</div>
            <div className="catalog-copy"><span className="category">{item.category}</span><h3>{item.name}</h3><p>{item.description}</p></div>
            <div className="catalog-footer"><span>v{item.version}</span>{item.installed
              ? <Button variant="secondary" onClick={() => launchCatalog(item)} disabled={workingId === item.id}>{workingId === item.id ? <LoaderCircle className="spin" size={15} /> : null} Open</Button>
              : <Button onClick={() => install(item)} disabled={workingId === item.id || (!item.installerAvailable && !item.sourceAvailable)}>{workingId === item.id ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} {workingId === item.id ? (item.installerAvailable ? 'Installing…' : 'Building…') : item.installerAvailable ? 'Install' : item.sourceAvailable ? 'Build & install' : 'Unavailable'}</Button>}</div>
          </Card>)}</div>}
      </section>

      <section className="library-section">
        <div className="section-heading"><div><Library size={15} /><h2>Your other apps</h2><span className="count">{apps.length}</span></div><Button variant="secondary" onClick={addApp} disabled={adding}>{adding ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Add your own</Button></div>
        {!loading && visibleApps.length === 0 ? <div className="custom-empty"><div><strong>{search ? 'No other apps found' : 'Room for your favorites'}</strong><span>{search ? 'Try another search.' : 'Add any application already installed on this computer.'}</span></div>{!search && <Button variant="secondary" onClick={addApp}><Plus size={15} /> Add app</Button>}</div>
        : <div className="app-grid">{visibleApps.map((item) => <Card role="button" className="app-card" key={item.id} onClick={() => launch(item.id)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && launch(item.id)}>
            <div className="app-icon-wrap"><img src={item.icon} alt="" />{launchingId === item.id && <span className="launch-loader"><LoaderCircle className="spin" size={17} /></span>}</div>
            <div className="app-info"><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}<span>{item.launchCount ? `${relativeTime(item.lastLaunchedAt)} · ${item.launchCount} opens` : 'Ready to open'}</span></div>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="card-menu" aria-label={`Options for ${item.name}`} onClick={(event) => event.stopPropagation()}><MoreHorizontal size={17} /></Button></DropdownMenuTrigger><DropdownMenuContent onClick={(event) => event.stopPropagation()}><DropdownMenuItem onSelect={() => openEdit(item)}><Pencil size={14} /> Edit details</DropdownMenuItem><DropdownMenuItem onSelect={() => refreshIcon(item.id)}><Image size={14} /> Refresh icon</DropdownMenuItem><DropdownMenuItem className="danger-item" onSelect={() => setDeleting(item)}><Trash2 size={14} /> Remove</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          </Card>)}</div>}
      </section>
    </main>

    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogTitle>Edit app</DialogTitle><DialogDescription>Choose how this application appears in Bento.</DialogDescription><form onSubmit={saveName}><label>Display name<Input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} /></label><label><span>Description <small className="optional">Optional</small></span><Textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={240} placeholder="What do you use this app for?" /></label><div className="dialog-actions"><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button>Save changes</Button></div></form></DialogContent></Dialog>
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}><AlertDialogContent><AlertDialogTitle>Remove {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>This removes the shortcut from Bento. It will not uninstall or delete the application.</AlertDialogDescription><div className="dialog-actions"><AlertDialogCancel asChild><Button variant="secondary">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="danger" onClick={remove}>Remove app</Button></AlertDialogAction></div></AlertDialogContent></AlertDialog>
  </div>
}

export default App

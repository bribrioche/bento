import { useEffect, useMemo, useState } from 'react'
import {
  Archive, ArrowDownUp, Check, CheckCircle2, ChevronsUpDown, CircleDot, Clock3,
  ExternalLink, FolderPlus, GitBranch, GitPullRequest, Globe2, HardDrive, Menu, MessageSquare, Moon, RefreshCw,
  Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Sun, Trash2, UserRound, X, XCircle,
} from 'lucide-react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { Spinner } from './components/ui/spinner'
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './components/ui/command'

type Tab = 'ALL' | 'NO_PR' | 'LOCAL_NO_PR' | PullRequestStatus
type Sort = 'updated' | 'created' | 'title'
type MergedFilter = 'all' | 'local'

const tabs: { id: Tab; label: string; icon: typeof GitPullRequest }[] = [
  { id: 'ALL', label: 'All pull requests', icon: GitPullRequest },
  { id: 'DRAFT', label: 'Drafts', icon: Archive },
  { id: 'OPEN', label: 'Open', icon: CircleDot },
  { id: 'MERGED', label: 'Merged', icon: CheckCircle2 },
  { id: 'NO_PR', label: 'Branches without PR', icon: GitBranch },
  { id: 'LOCAL_NO_PR', label: 'Local branches without PR', icon: HardDrive },
]

function formatDate(date: string) {
  if (!date) return '—'
  const value = new Date(date)
  const days = Math.floor((Date.now() - value.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: value.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }).format(value)
}

function StatusPill({ status }: { status: PullRequestStatus }) {
  return <Badge variant={status.toLowerCase() as 'open' | 'draft' | 'merged'}>
    {status === 'MERGED' ? <CheckCircle2 size={13} /> : status === 'DRAFT' ? <Archive size={13} /> : <CircleDot size={13} />}
    {status.charAt(0) + status.slice(1).toLowerCase()}
  </Badge>
}

function UserFilter({ value, users, onChange }: { value:string; users:string[]; onChange:(value:string)=>void }) {
  const [open, setOpen] = useState(false)
  const label = value === 'ALL' ? 'All users' : value
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="secondary" className="user-filter-trigger" role="combobox" aria-expanded={open} aria-label="Filter branches by user"><UserRound size={15} /><span>{label}</span><ChevronsUpDown size={14} /></Button></PopoverTrigger>
    <PopoverContent className="user-filter-popover">
      <Command>
        <CommandInput placeholder="Search users…" />
        <CommandList>
          <CommandEmpty>No user found.</CommandEmpty>
          <CommandGroup>
            <CommandItem value="All users" onSelect={() => { onChange('ALL'); setOpen(false) }}><Check className={value === 'ALL' ? 'command-check visible' : 'command-check'} size={14} />All users</CommandItem>
            {users.map((user) => <CommandItem value={user} key={user} onSelect={() => { onChange(user); setOpen(false) }}><Check className={value === user ? 'command-check visible' : 'command-check'} size={14} />{user}</CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
}

function ConnectionModal({ initial, onClose, onConnected }: {
  initial: ConnectionSettings
  onClose: () => void
  onConnected: (settings: ConnectionSettings) => void
}) {
  const [workspace, setWorkspace] = useState(initial.workspace)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const saved = await window.pullscope.saveSettings({ workspace, email: initial.email || '', token })
      onConnected(saved)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save connection.') }
    finally { setSaving(false) }
  }

  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent aria-labelledby="connection-title">
      <div className="modal-mark"><ShieldCheck size={24} /></div>
      <DialogTitle id="connection-title">Connect Bitbucket</DialogTitle>
      <DialogDescription className="modal-intro">Add a read-only API token to bring your pull requests into one quiet workspace.</DialogDescription>
      <form onSubmit={submit}>
        <label>Workspace slug<Input autoFocus value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="acme-engineering" required /></label>
        <label>Bitbucket API token
          <div className="token-field">
            <Input type={showToken ? 'text' : 'password'} value={token} onChange={(e) => setToken(e.target.value)} placeholder={initial.hasToken ? 'Leave blank to keep current token' : 'Paste your token'} required={!initial.hasToken} />
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowToken(!showToken)}>{showToken ? 'Hide' : 'Show'}</Button>
          </div>
        </label>
        <div className="permission-note"><ShieldCheck size={16} /><span>Use a token with <strong>User data: Read</strong>, <strong>Repositories: Read</strong>, and <strong>Pull requests: Read</strong>. Your email is not required.</span></div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={saving}>{saving && <Spinner size={16} label="Saving connection" />} Save & sync</Button></div>
      </form>
    </DialogContent>
  </Dialog>
}

function App() {
  const [settings, setSettings] = useState<ConnectionSettings>({ workspace: '', email: '', hasToken: false })
  const [data, setData] = useState<SyncResult | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('ALL')
  const [search, setSearch] = useState('')
  const [repository, setRepository] = useState('ALL')
  const [sort, setSort] = useState<Sort>('updated')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light')
  const [showConnection, setShowConnection] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [browsers, setBrowsers] = useState<BrowserOption[]>([{ id: 'default', name: 'System default' }])
  const [browser, setBrowser] = useState('default')
  const [localRepositories, setLocalRepositories] = useState<LocalRepository[]>([])
  const [showLocalRepositories, setShowLocalRepositories] = useState(false)
  const [branchAuthor, setBranchAuthor] = useState('ALL')
  const [mergedFilter, setMergedFilter] = useState<MergedFilter>('all')
  const [visibleLimit, setVisibleLimit] = useState(10)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
    window.pullscope.setTheme(theme)
  }, [theme])

  useEffect(() => {
    Promise.all([window.pullscope.getSettings(), window.pullscope.getCachedData(), window.pullscope.getBrowsers(), window.pullscope.getLocalRepositories()]).then(([stored, cached, browserSettings, localRepos]) => {
      setSettings(stored); setData(cached)
      setBrowsers(browserSettings.browsers); setBrowser(browserSettings.selected)
      setLocalRepositories(localRepos)
      if (!stored.hasToken) setShowConnection(true)
      else if (!cached) {
        setSyncing(true)
        window.pullscope.sync().then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : 'Sync failed.')).finally(() => setSyncing(false))
      }
    }).catch((cause) => setError(cause.message))
  }, [])

  useEffect(() => { setVisibleLimit(10) }, [activeTab, search, repository, sort, branchAuthor, mergedFilter, localRepositories, data?.syncedAt])

  async function chooseBrowser(value: string) {
    setError('')
    try { setBrowser(await window.pullscope.setBrowser(value)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change browser.') }
  }

  async function addLocalRepository() {
    setError('')
    try { setLocalRepositories(await window.pullscope.addLocalRepository()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add the local repository.') }
  }

  async function removeLocalRepository(id: string) {
    setError('')
    try { setLocalRepositories(await window.pullscope.removeLocalRepository(id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove the local repository.') }
  }

  async function refreshLocalRepositories() {
    setError('')
    try { setLocalRepositories(await window.pullscope.refreshLocalRepositories()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not refresh local branches.') }
  }

  async function sync() {
    setSyncing(true); setError('')
    try {
      if (activeTab === 'LOCAL_NO_PR') setLocalRepositories(await window.pullscope.refreshLocalRepositories())
      else setData(await window.pullscope.sync())
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sync failed.') }
    finally { setSyncing(false) }
  }

  async function connected(next: ConnectionSettings) {
    setSettings(next); setShowConnection(false)
    setSyncing(true); setError('')
    try { setData(await window.pullscope.sync()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Connection saved, but sync failed.') }
    finally { setSyncing(false) }
  }

  const prs = data?.pullRequests || []
  const branches = data?.branchesWithoutPr || []
  const connectedPullRequestBranches = useMemo(() => new Set(data?.connectedPullRequestBranches || []), [data?.connectedPullRequestBranches])
  const localBranchesWithoutPr = useMemo<LocalBranchWithoutPr[]>(() => localRepositories.flatMap((repo) => repo.branches
    .filter((branch) => branch !== repo.defaultBranch && !connectedPullRequestBranches.has(`${repo.repositorySlug}:${branch}`.toLowerCase()))
    .map((branch) => ({ key: `${repo.id}:${branch}`, name: branch, repository: repo.name, path: repo.path }))), [localRepositories, connectedPullRequestBranches])
  const localBranchKeys = useMemo(() => new Set(localRepositories.flatMap((repo) => repo.branches.map((branch) => `${repo.repositorySlug}:${branch}`.toLowerCase()))), [localRepositories])
  const repositories = useMemo(() => [...new Set([...prs.map((pr) => pr.repository), ...branches.map((branch) => branch.repository), ...localBranchesWithoutPr.map((branch) => branch.repository)])].sort(), [prs, branches, localBranchesWithoutPr])
  const branchAuthors = useMemo(() => [...new Set(branches.map((branch) => branch.authorName).filter(Boolean))].sort(), [branches])
  const counts = useMemo(() => Object.fromEntries(tabs.map((tab) => [tab.id, tab.id === 'ALL' ? prs.length : tab.id === 'NO_PR' ? branches.length : tab.id === 'LOCAL_NO_PR' ? localBranchesWithoutPr.length : prs.filter((pr) => pr.status === tab.id).length])), [prs, branches, localBranchesWithoutPr])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return prs.filter((pr) =>
      activeTab !== 'NO_PR' && activeTab !== 'LOCAL_NO_PR' && (activeTab === 'ALL' || pr.status === activeTab) &&
      (activeTab !== 'MERGED' || mergedFilter === 'all' || localBranchKeys.has(`${pr.repositorySlug}:${pr.sourceBranch}`.toLowerCase())) &&
      (repository === 'ALL' || pr.repository === repository) &&
      (!term || `${pr.title} ${pr.repository} ${pr.sourceBranch}`.toLowerCase().includes(term))
    ).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : new Date(sort === 'created' ? b.createdOn : b.updatedOn).getTime() - new Date(sort === 'created' ? a.createdOn : a.updatedOn).getTime())
  }, [prs, activeTab, repository, search, sort, mergedFilter, localBranchKeys])
  const visibleBranches = useMemo(() => {
    const term = search.trim().toLowerCase()
    return branches.filter((branch) =>
      (repository === 'ALL' || branch.repository === repository) &&
      (branchAuthor === 'ALL' || branch.authorName === branchAuthor) &&
      (!term || `${branch.name} ${branch.repository} ${branch.authorName}`.toLowerCase().includes(term))
    ).sort((a, b) => sort === 'title' ? a.name.localeCompare(b.name) : new Date(b.updatedOn).getTime() - new Date(a.updatedOn).getTime())
  }, [branches, repository, search, sort, branchAuthor])
  const visibleLocalBranches = useMemo(() => {
    const term = search.trim().toLowerCase()
    return localBranchesWithoutPr.filter((branch) =>
      (repository === 'ALL' || branch.repository === repository) &&
      (!term || `${branch.name} ${branch.repository} ${branch.path}`.toLowerCase().includes(term))
    ).sort((a, b) => a.name.localeCompare(b.name))
  }, [localBranchesWithoutPr, repository, search])
  const shownPullRequests = visible.slice(0, visibleLimit)
  const shownBranches = visibleBranches.slice(0, visibleLimit)
  const shownLocalBranches = visibleLocalBranches.slice(0, visibleLimit)
  const currentTotal = activeTab === 'NO_PR' ? visibleBranches.length : activeTab === 'LOCAL_NO_PR' ? visibleLocalBranches.length : visible.length
  const hasMore = visibleLimit < currentTotal

  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label || ''
  const isRemoteBranchView = activeTab === 'NO_PR'
  const isLocalBranchView = activeTab === 'LOCAL_NO_PR'
  const isBranchView = isRemoteBranchView || isLocalBranchView

  return <div className="app-shell">
    <header className="titlebar"><div className="brand"><span>pullscope</span></div></header>
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <nav>
        <p className="nav-heading">Workspace</p>
        {tabs.map(({ id, label, icon: Icon }) => <Button variant="ghost" key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => { setActiveTab(id); setSidebarOpen(false) }}><Icon size={17} /><span>{label}</span><small>{counts[id] || 0}</small></Button>)}
      </nav>
      <div className="sidebar-bottom">
        <Button variant="ghost" className="nav-item" onClick={() => setShowLocalRepositories(true)}><HardDrive size={17} /><span>Local repositories</span><small>{localRepositories.length}</small></Button>
        <Button variant="ghost" className="nav-item" onClick={() => setShowConnection(true)}><Settings size={17} /><span>Connection</span>{settings.hasToken && <span className="connection-dot" />}</Button>
        <Button variant="ghost" className="nav-item" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></Button>
        <div className="workspace-card"><div className="workspace-avatar">{settings.workspace?.slice(0, 2).toUpperCase() || 'PS'}</div><div><strong>{settings.workspace || 'Not connected'}</strong><span>{settings.hasToken ? 'Bitbucket Cloud' : 'Add your Bitbucket account'}</span></div></div>
      </div>
    </aside>

    <main>
      <div className="mobile-top"><Button variant="icon" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={20} /></Button></div>
      <div className="content">
        <div className="page-heading">
          <div><div className="eyebrow"><span /> Bitbucket workspace</div><h1>{activeLabel}</h1><p>{isLocalBranchView ? `${visibleLocalBranches.length} local ${visibleLocalBranches.length === 1 ? 'branch' : 'branches'} without a connected PR` : isRemoteBranchView ? `${visibleBranches.length} remote ${visibleBranches.length === 1 ? 'branch' : 'branches'} without an open PR` : `${visible.length} ${visible.length === 1 ? 'pull request' : 'pull requests'} across ${data?.repositoryCount || 0} repositories`}</p></div>
          <Button className="sync-button" onClick={sync} disabled={syncing || (isLocalBranchView ? !localRepositories.length : !settings.hasToken)}>{syncing ? <Spinner size={16} label={isLocalBranchView ? 'Scanning local branches' : 'Syncing pull requests'} /> : <RefreshCw size={16} />}{syncing ? (isLocalBranchView ? 'Scanning…' : 'Syncing…') : (isLocalBranchView ? 'Refresh local' : 'Sync now')}</Button>
        </div>

        {error && <div className="alert"><XCircle size={17} /><span>{error}</span><Button variant="ghost" size="icon" onClick={() => setError('')}><X size={15} /></Button></div>}
        {data?.warnings && data.warnings.length > 0 && <div className="warning">Some repositories could not be read. Showing all available results.</div>}

        <div className="toolbar">
          <div className="search"><Search size={17} /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isBranchView ? 'Search branches…' : 'Search pull requests…'} />{search && <Button variant="ghost" size="icon" onClick={() => setSearch('')}><X size={14} /></Button>}</div>
          <div className="toolbar-actions">
            {activeTab === 'MERGED' && <Select value={mergedFilter} onValueChange={(value) => setMergedFilter(value as MergedFilter)}><SelectTrigger aria-label="Local branch filter"><HardDrive size={15} /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All merged</SelectItem><SelectItem value="local">Local branch remains</SelectItem></SelectContent></Select>}
            {activeTab === 'NO_PR' && <UserFilter value={branchAuthor} users={branchAuthors} onChange={setBranchAuthor} />}
            <Select value={browser} onValueChange={chooseBrowser}><SelectTrigger aria-label="Browser for links"><Globe2 size={15} /><SelectValue /></SelectTrigger><SelectContent>{browsers.map((item) => <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
            <Select value={repository} onValueChange={setRepository}><SelectTrigger><SlidersHorizontal size={15} /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All repositories</SelectItem>{repositories.map((repo) => <SelectItem value={repo} key={repo}>{repo}</SelectItem>)}</SelectContent></Select>
            {!isLocalBranchView && <Select value={sort} onValueChange={(value) => setSort(value as Sort)}><SelectTrigger><ArrowDownUp size={15} /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="updated">Recently updated</SelectItem>{!isRemoteBranchView && <SelectItem value="created">Recently created</SelectItem>}<SelectItem value="title">Title A–Z</SelectItem></SelectContent></Select>}
          </div>
        </div>

        <section className="pr-panel">
          <div className={`table-head ${isBranchView ? 'branch-head' : ''}`}><span>{isBranchView ? 'Branch' : 'Pull request'}</span><span>{isLocalBranchView ? 'Location' : isRemoteBranchView ? 'Last commit' : 'Status'}</span><span>{isLocalBranchView ? 'Repository' : 'Activity'}</span><span>{isBranchView ? 'PR status' : 'Review'}</span><span /></div>
          {syncing ? <div className="empty"><span className="empty-icon"><Spinner size={25} label={isLocalBranchView ? 'Scanning local branches' : 'Gathering workspace activity'} /></span><h3>{isLocalBranchView ? 'Scanning local branches' : 'Gathering workspace activity'}</h3><p>{isLocalBranchView ? 'Reading branch names from your local Git repositories.' : 'This can take a moment for larger workspaces.'}</p></div>
          : isLocalBranchView ? (visibleLocalBranches.length === 0 ? <div className="empty"><span className="empty-icon"><HardDrive size={23} /></span><h3>{localRepositories.length ? 'No local branches without a PR' : 'Add a local repository'}</h3><p>{localRepositories.length ? 'Every local non-default branch is connected to a pull request.' : 'Add your cloned Git repositories to compare local branches with Bitbucket.'}</p>{!localRepositories.length && <Button onClick={() => setShowLocalRepositories(true)}>Add local repository</Button>}</div>
          : <div className="pr-list">{shownLocalBranches.map((branch) => <article className="pr-row branch-row local-branch-row" key={branch.key}>
              <div className="pr-main"><div className="repo-line"><span>{branch.repository}</span></div><h3><GitBranch size={14} />{branch.name}</h3></div>
              <div className="branch-author" title={branch.path}>{branch.path}</div>
              <div className="activity"><span><HardDrive size={14} />{branch.repository}</span></div>
              <code className="commit-hash">No PR</code>
              <span />
            </article>)}</div>)
          : isRemoteBranchView ? (visibleBranches.length === 0 ? <div className="empty"><span className="empty-icon"><GitBranch size={23} /></span><h3>No branches without a PR</h3><p>Every non-default branch currently has an open pull request.</p></div>
          : <div className="pr-list">{shownBranches.map((branch) => <article className="pr-row branch-row" key={branch.key} onClick={() => window.pullscope.openExternal(branch.url)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && window.pullscope.openExternal(branch.url)}>
              <div className="pr-main"><div className="repo-line"><span>{branch.repository}</span></div><h3><GitBranch size={14} />{branch.name}</h3></div>
              <div className="branch-author">{branch.authorName}</div>
              <div className="activity"><span><Clock3 size={14} />{formatDate(branch.updatedOn)}</span></div>
              <code className="commit-hash">{branch.commitHash}</code>
              <Button variant="icon" className="open-button" aria-label={`Open ${branch.name}`}><ExternalLink size={16} /></Button>
            </article>)}</div>)
          : visible.length === 0 ? <div className="empty"><span className="empty-icon"><Sparkles size={23} /></span><h3>{settings.hasToken ? 'Nothing to review here' : 'Connect your workspace'}</h3><p>{settings.hasToken ? 'Try another status, repository, or search.' : 'Your pull requests will appear here after the first sync.'}</p>{!settings.hasToken && <Button onClick={() => setShowConnection(true)}>Connect Bitbucket</Button>}</div>
          : <div className="pr-list">{shownPullRequests.map((pr) => <article className="pr-row" key={pr.key} onClick={() => window.pullscope.openExternal(pr.url)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && window.pullscope.openExternal(pr.url)}>
              <div className="pr-main"><div className="repo-line"><span>{pr.repository}</span><span>#{pr.id}</span></div><h3>{pr.title}</h3><div className="branch-line"><span>{pr.sourceBranch}</span><span>→</span><span>{pr.destinationBranch}</span></div></div>
              <div><StatusPill status={pr.status} /></div>
              <div className="activity"><span><Clock3 size={14} />{formatDate(pr.updatedOn)}</span><span><MessageSquare size={14} />{pr.commentCount} {pr.commentCount === 1 ? 'comment' : 'comments'}</span></div>
              <div className="review"><span className={pr.approvals ? 'positive' : ''}><Check size={15} />{pr.approvals} approved</span><span className={pr.changesRequested ? 'negative' : ''}><X size={15} />{pr.changesRequested} changes</span></div>
              <Button variant="icon" className="open-button" aria-label={`Open ${pr.title}`}><ExternalLink size={16} /></Button>
            </article>)}</div>}
          {hasMore && <div className="load-more"><Button variant="secondary" onClick={() => setVisibleLimit((current) => current + 10)}>Load 10 more</Button><span>Showing {Math.min(visibleLimit, currentTotal)} of {currentTotal}</span></div>}
        </section>
        {data?.syncedAt && <p className="last-sync">Last synced {formatDate(data.syncedAt)} · Cached locally</p>}
      </div>
    </main>
    {showConnection && <ConnectionModal initial={settings} onClose={() => setShowConnection(false)} onConnected={connected} />}
    <Dialog open={showLocalRepositories} onOpenChange={setShowLocalRepositories}>
      <DialogContent className="local-repositories-modal">
        <div className="local-modal-heading"><div className="modal-mark"><HardDrive size={23} /></div><div><DialogTitle>Local repositories</DialogTitle><DialogDescription>Pullscope reads local branch names with Git. Your files are never modified.</DialogDescription></div></div>
        <div className="local-repository-list">
          {localRepositories.length === 0 ? <div className="local-empty"><GitBranch size={21} /><span>No local repositories added.</span></div> : localRepositories.map((repo) => <div className="local-repository" key={repo.id}>
            <div><strong>{repo.name}</strong><span title={repo.path}>{repo.path}</span><small className={repo.error ? 'local-error' : ''}>{repo.error || `${repo.branches.length} local ${repo.branches.length === 1 ? 'branch' : 'branches'}`}</small></div>
            <Button variant="ghost" size="icon" aria-label={`Remove ${repo.name}`} onClick={() => removeLocalRepository(repo.id)}><Trash2 size={16} /></Button>
          </div>)}
        </div>
        <div className="modal-actions"><Button variant="secondary" onClick={refreshLocalRepositories}><RefreshCw size={15} /> Refresh</Button><Button onClick={addLocalRepository}><FolderPlus size={16} /> Add repository</Button></div>
      </DialogContent>
    </Dialog>
  </div>
}

export default App

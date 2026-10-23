import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileText,
  FilePlus2,
  FolderOpen,
  Home,
  ListTree,
  LoaderCircle,
  Menu,
  Moon,
  PanelRightOpen,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react'

type Theme = 'light' | 'dark'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type OutlineItem = { id: string; text: string; level: number }
type OpenTab = { id: string; document: MarkdownDocument }

const demoDocument: MarkdownDocument = {
  name: 'welcome-to-lumen.md',
  path: 'Preview document',
  size: 1142,
  modifiedAt: new Date().toISOString(),
  openedAt: new Date().toISOString(),
  content: `# Welcome to Lumen

Lumen is a quiet place for your Markdown documents. It stays out of the way so your words can take center stage.

## Everything you need, nothing you don't

- **Beautiful reading** with carefully tuned typography
- **Local by design** — your documents never leave your computer
- **Always current** — files are read directly from disk

> A good reading tool should feel less like software and more like a well-lit desk.

## A small code sample

\`\`\`ts
const document = await lumen.open('notes.md')
console.log(document.title)
\`\`\`

Open your first document to begin.`,
}

function formatRelative(date: string) {
  const delta = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.floor(delta / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(date))
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function readableTitle(name: string) {
  return name.replace(/\.(md|markdown|mdown|mkd)$/i, '').replace(/[-_]+/g, ' ')
}

function updateTaskCheckbox(content: string, targetIndex: number, checked: boolean) {
  let taskIndex = -1
  return content.replace(/^(\s*(?:(?:[-+*])|(?:\d+[.)]))\s+\[)([ xX])(\])/gm, (match, before, _state, after) => {
    taskIndex += 1
    return taskIndex === targetIndex ? `${before}${checked ? 'x' : ' '}${after}` : match
  })
}

function prepareTaskCheckboxes(html: string, interactive: boolean) {
  let taskIndex = -1
  return html.replace(/<input\b([^>]*\btype="checkbox"[^>]*)>/gi, (_match, attributes: string) => {
    taskIndex += 1
    const enabledAttributes = interactive
      ? attributes.replace(/\sdisabled(?:="")?/gi, '')
      : attributes
    const title = interactive ? 'Click to update this task' : 'Open a local file to update tasks'
    return `<input${enabledAttributes} data-task-index="${taskIndex}" title="${title}">`
  })
}

function buildDocumentOutline(html: string): { html: string; headings: OutlineItem[] } {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const usedIds = new Map<string, number>()
  const headings = Array.from(parsed.body.querySelectorAll('h1, h2, h3, h4')).map((heading, index) => {
    const text = heading.textContent?.trim() || `Section ${index + 1}`
    const baseId = text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `section-${index + 1}`
    const duplicate = usedIds.get(baseId) || 0
    usedIds.set(baseId, duplicate + 1)
    const id = duplicate === 0 ? baseId : `${baseId}-${duplicate + 1}`
    heading.id = id
    return { id, text, level: Number(heading.tagName.slice(1)) }
  })
  return { html: parsed.body.innerHTML, headings }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('lumen-theme') as Theme) || 'light')
  const [recents, setRecents] = useState<RecentFile[]>([])
  const [document, setDocument] = useState<MarkdownDocument | null>(null)
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [activeHeading, setActiveHeading] = useState('')
  const [outlineOpen, setOutlineOpen] = useState(() => localStorage.getItem('lumen-outline-open') !== 'false')
  const [outlineWidth, setOutlineWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem('lumen-outline-width'))
    return Number.isFinite(savedWidth) && savedWidth >= 160 && savedWidth <= 360 ? savedWidth : 218
  })
  const articleRef = useRef<HTMLElement>(null)
  const dragDepthRef = useRef(0)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const pendingSavesRef = useRef(0)

  const refreshRecents = useCallback(async () => {
    if (!window.lumen) return
    setRecents(await window.lumen.listRecents())
  }, [])

  useEffect(() => {
    documentElement.dataset.theme = theme
    localStorage.setItem('lumen-theme', theme)
  }, [theme])

  const openDocument = useCallback((next: MarkdownDocument) => {
    setDocument(next)
    setTabs((current) => {
      const existing = current.findIndex((tab) => tab.document.path === next.path)
      if (existing >= 0) return current.map((tab, index) => index === existing ? { ...tab, document: next } : tab)
      return [...current, { id: next.path, document: next }]
    })
    setSaveState('idle')
    setError('')
    setSidebarOpen(false)
    requestAnimationFrame(() => articleRef.current?.scrollTo({ top: 0 }))
    void refreshRecents()
  }, [refreshRecents])

  useEffect(() => {
    refreshRecents()
    if (!window.lumen) return
    const stopOpened = window.lumen.onFileOpened((next) => openDocument(next))
    const stopDropped = window.lumen.onFilesDropped((documents) => documents.forEach(openDocument))
    const stopError = window.lumen.onFileError((message) => setError(message))
    return () => {
      stopOpened()
      stopDropped()
      stopError()
    }
  }, [openDocument, refreshRecents])

  const chooseFile = useCallback(async () => {
    if (!window.lumen) {
      openDocument(demoDocument)
      return
    }
    setLoading(true)
    try {
      const next = await window.lumen.chooseFile()
      if (next) openDocument(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open that file.')
    } finally {
      setLoading(false)
    }
  }, [openDocument])

  const refreshDocument = useCallback(async () => {
    if (!document || document.path === 'Preview document' || !window.lumen || saveState === 'saving') return
    setRefreshing(true)
    try {
      const refreshed = await window.lumen.reloadDocument(document.path)
      setDocument(refreshed)
      setTabs((current) => current.map((tab) => tab.document.path === refreshed.path ? { ...tab, document: refreshed } : tab))
      setSaveState('idle')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The document could not be refreshed.')
    } finally {
      setRefreshing(false)
    }
  }, [document, saveState])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        void chooseFile()
      }
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') || event.key === 'F5') {
        event.preventDefault()
        void refreshDocument()
      }
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chooseFile, refreshDocument])

  const openRecent = async (file: RecentFile) => {
    if (!window.lumen) return
    setLoading(true)
    try {
      openDocument(await window.lumen.openRecent(file.path))
    } catch {
      setError(`“${file.name}” could not be found. It may have been moved or deleted.`)
    } finally {
      setLoading(false)
    }
  }

  const goHome = () => {
    setDocument(null)
    setSidebarOpen(false)
    setError('')
    void refreshRecents()
  }

  const selectTab = (tab: OpenTab) => {
    setDocument(tab.document)
    setSaveState('idle')
    setError('')
    requestAnimationFrame(() => articleRef.current?.scrollTo({ top: 0 }))
  }

  const closeTab = (tabId: string) => {
    const index = tabs.findIndex((tab) => tab.id === tabId)
    if (index < 0) return
    const nextTabs = tabs.filter((tab) => tab.id !== tabId)
    setTabs(nextTabs)
    if (document?.path === tabs[index].document.path) {
      const replacement = nextTabs[Math.min(index, nextTabs.length - 1)]
      setDocument(replacement?.document || null)
      setSaveState('idle')
    }
  }

  const filteredRecents = recents.filter((file) =>
    `${file.name} ${file.path}`.toLowerCase().includes(query.toLowerCase()),
  )

  const renderedMarkdown = useMemo(() => {
    if (!document) return { html: '', headings: [] as OutlineItem[] }
    const raw = marked.parse(document.content, { gfm: true, breaks: false }) as string
    const withInteractiveTasks = prepareTaskCheckboxes(raw, document.path !== 'Preview document' && Boolean(window.lumen))
    return buildDocumentOutline(DOMPurify.sanitize(withInteractiveTasks))
  }, [document])

  useEffect(() => {
    const reader = articleRef.current
    if (!reader || renderedMarkdown.headings.length === 0) {
      setActiveHeading('')
      return
    }

    const updateActiveHeading = () => {
      const headingElements = Array.from(reader.querySelectorAll<HTMLElement>('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4'))
      let current = headingElements[0]?.id || ''
      const readingLine = reader.scrollTop + 150
      for (const heading of headingElements) {
        if (heading.offsetTop <= readingLine) current = heading.id
        else break
      }
      setActiveHeading(current)
    }

    updateActiveHeading()
    reader.addEventListener('scroll', updateActiveHeading, { passive: true })
    return () => reader.removeEventListener('scroll', updateActiveHeading)
  }, [renderedMarkdown])

  const scrollToHeading = (id: string) => {
    const heading = articleRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveHeading(id)
  }

  const setOutlineVisibility = (open: boolean) => {
    setOutlineOpen(open)
    localStorage.setItem('lumen-outline-open', String(open))
  }

  const resizeOutline = (width: number) => {
    const nextWidth = Math.min(360, Math.max(160, width))
    setOutlineWidth(nextWidth)
    localStorage.setItem('lumen-outline-width', String(nextWidth))
  }

  const beginOutlineResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = outlineWidth
    window.document.body.classList.add('is-resizing-outline')

    const onPointerMove = (moveEvent: PointerEvent) => {
      resizeOutline(startWidth + startX - moveEvent.clientX)
    }
    const onPointerUp = () => {
      window.document.removeEventListener('pointermove', onPointerMove)
      window.document.removeEventListener('pointerup', onPointerUp)
      window.document.body.classList.remove('is-resizing-outline')
    }

    window.document.addEventListener('pointermove', onPointerMove)
    window.document.addEventListener('pointerup', onPointerUp)
  }

  const toggleTask = (taskIndex: number, checked: boolean) => {
    if (!document || document.path === 'Preview document' || !window.lumen) return
    const content = updateTaskCheckbox(document.content, taskIndex, checked)
    if (content === document.content) return

    const filePath = document.path
    const nextDocument = { ...document, content }
    setDocument(nextDocument)
    setTabs((current) => current.map((tab) => tab.document.path === filePath ? { ...tab, document: nextDocument } : tab))
    pendingSavesRef.current += 1
    setSaveState('saving')

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const saved = await window.lumen!.saveDocument(filePath, content)
        setDocument((current) => current?.path === filePath ? { ...current, ...saved } : current)
        setTabs((current) => current.map((tab) => tab.document.path === filePath ? { ...tab, document: { ...tab.document, ...saved } } : tab))
        pendingSavesRef.current -= 1
        if (pendingSavesRef.current === 0) setSaveState('saved')
      })
      .catch((cause) => {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1)
        setSaveState('error')
        setError(cause instanceof Error ? cause.message : 'The task could not be saved.')
      })
  }

  const handleArticleClick = (event: React.MouseEvent) => {
    if (event.target instanceof HTMLInputElement && event.target.matches('input[type="checkbox"][data-task-index]')) {
      const taskIndex = Number(event.target.dataset.taskIndex)
      if (Number.isInteger(taskIndex)) toggleTask(taskIndex, event.target.checked)
      return
    }
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (href?.startsWith('http://') || href?.startsWith('https://')) {
      event.preventDefault()
      void window.lumen?.openExternal(href)
    }
  }

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault()
    if (!event.dataTransfer.types.includes('Files')) return
    dragDepthRef.current += 1
    setDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDragActive(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setDragActive(false)
  }

  return (
    <div className="app-shell" onDragEnter={handleDragEnter} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {document && (
        <>
          <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
            <div className="brand brand--sidebar"><Logo /> <span>Lumen</span></div>
            <nav>
              <button className="nav-item" onClick={goHome}><Home size={17} /> Home</button>
              <button className="nav-item" onClick={chooseFile}><FolderOpen size={17} /> Open file</button>
            </nav>
            <p className="sidebar-label">Recent</p>
            <div className="sidebar-recents">
              {recents.slice(0, 8).map((file) => (
                <button className={`sidebar-file ${file.path === document.path ? 'is-active' : ''}`} key={file.path} onClick={() => openRecent(file)}>
                  <FileText size={15} /> <span>{readableTitle(file.name)}</span>
                </button>
              ))}
            </div>
            <div className="sidebar-footer">Local files · Tasks auto-save</div>
          </aside>
          {sidebarOpen && <button aria-label="Close sidebar" className="scrim" onClick={() => setSidebarOpen(false)} />}
        </>
      )}

      <main className={document ? 'main main--reader' : 'main'}>
        <header className="topbar">
          <div className="topbar-left">
            {document ? (
              <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
            ) : <div className="brand"><Logo /><span>Lumen</span></div>}
          </div>
          {tabs.length > 0 && (
            <div className="topbar-tabs">
              <div className="tabs-scroll" role="tablist" aria-label="Open Markdown files">
                {tabs.map((tab) => {
                  const active = document?.path === tab.document.path
                  return (
                    <div className={`file-tab ${active ? 'is-active' : ''}`} key={tab.id}>
                      <button className="tab-select" role="tab" aria-selected={active} onClick={() => selectTab(tab)} onAuxClick={(event) => { if (event.button === 1) closeTab(tab.id) }} title={tab.document.path}>
                        <FileText size={14} /><span>{tab.document.name}</span>
                      </button>
                      <button className="tab-close" onClick={() => closeTab(tab.id)} aria-label={`Close ${tab.document.name}`} title="Close tab"><X size={13} /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className="topbar-actions">
            {document && renderedMarkdown.headings.length > 0 && !outlineOpen && (
              <button className="icon-button outline-toggle" onClick={() => setOutlineVisibility(true)} title="Show document sections" aria-label="Show document sections">
                <PanelRightOpen size={17} />
              </button>
            )}
            {document && document.path !== 'Preview document' && (
              <button className="icon-button refresh-button" onClick={refreshDocument} disabled={refreshing || saveState === 'saving'} title="Reload from disk (Ctrl+R)" aria-label="Reload document from disk">
                <RefreshCw size={17} className={refreshing ? 'spin' : ''} />
              </button>
            )}
            <button className="icon-button theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </header>

        {error && <div className="toast"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}

        {document ? (
          <div className="reader-layout">
            <article className="reader-scroll" ref={articleRef}>
              <div className="document-wrap">
                <div className="document-kicker"><FileText size={17} /> Markdown document</div>
                <h1 className="document-title">{readableTitle(document.name)}</h1>
                <div className="document-meta">
                  <span><CalendarDays size={14} /> Updated {formatRelative(document.modifiedAt)}</span>
                  <span>{formatSize(document.size)}</span>
                  {document.path !== 'Preview document' && <button onClick={() => window.lumen?.showInFolder(document.path)}><ExternalLink size={13} /> Show in folder</button>}
                  {document.path !== 'Preview document' && saveState !== 'idle' && (
                    <span className={`save-status save-status--${saveState}`} aria-live="polite">
                      {saveState === 'saving' && <><LoaderCircle size={13} className="spin" /> Saving…</>}
                      {saveState === 'saved' && <><CheckCircle2 size={13} /> Saved</>}
                      {saveState === 'error' && <><CircleAlert size={13} /> Save failed</>}
                    </span>
                  )}
                </div>
                <div className="rule" />
                <div className="markdown-body" onClick={handleArticleClick} dangerouslySetInnerHTML={{ __html: renderedMarkdown.html }} />
                <div className="end-mark"><Logo /><span>End of document</span></div>
              </div>
            </article>
            {renderedMarkdown.headings.length > 0 && outlineOpen && (
              <aside className="document-outline" aria-label="Document sections" style={{ width: outlineWidth, flexBasis: outlineWidth }}>
                <div
                  className="outline-resizer"
                  role="separator"
                  aria-label="Resize document sections"
                  aria-orientation="vertical"
                  aria-valuemin={160}
                  aria-valuemax={360}
                  aria-valuenow={outlineWidth}
                  tabIndex={0}
                  onPointerDown={beginOutlineResize}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') { event.preventDefault(); resizeOutline(outlineWidth + 10) }
                    if (event.key === 'ArrowRight') { event.preventDefault(); resizeOutline(outlineWidth - 10) }
                  }}
                />
                <div className="outline-header">
                  <div className="outline-title"><ListTree size={14} /> On this page</div>
                  <button className="outline-close" onClick={() => setOutlineVisibility(false)} title="Hide document sections" aria-label="Hide document sections"><X size={15} /></button>
                </div>
                <nav>
                  {renderedMarkdown.headings.map((heading) => (
                    <button
                      key={heading.id}
                      className={`outline-item outline-item--level-${heading.level} ${activeHeading === heading.id ? 'is-active' : ''}`}
                      onClick={() => scrollToHeading(heading.id)}
                      title={heading.text}
                    >
                      {heading.text}
                    </button>
                  ))}
                </nav>
              </aside>
            )}
          </div>
        ) : (
          <HomeView
            recents={filteredRecents}
            totalCount={recents.length}
            query={query}
            loading={loading}
            setQuery={setQuery}
            chooseFile={chooseFile}
            openRecent={openRecent}
            removeRecent={async (file) => window.lumen && setRecents(await window.lumen.removeRecent(file.path))}
            clearRecents={async () => window.lumen && setRecents(await window.lumen.clearRecents())}
          />
        )}
      </main>
      {dragActive && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card"><FilePlus2 size={30} /><strong>Drop Markdown files here</strong><span>They’ll open in new tabs</span></div>
        </div>
      )}
    </div>
  )
}

function HomeView({ recents, totalCount, query, loading, setQuery, chooseFile, openRecent, removeRecent, clearRecents }: {
  recents: RecentFile[]
  totalCount: number
  query: string
  loading: boolean
  setQuery: (query: string) => void
  chooseFile: () => void
  openRecent: (file: RecentFile) => void
  removeRecent: (file: RecentFile) => void
  clearRecents: () => void
}) {
  const [confirmation, setConfirmation] = useState<
    { kind: 'clear' } | { kind: 'file'; file: RecentFile } | null
  >(null)

  useEffect(() => {
    if (!confirmation) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmation(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [confirmation])

  const confirmRemoval = () => {
    if (!confirmation) return
    if (confirmation.kind === 'clear') clearRecents()
    else removeRecent(confirmation.file)
    setConfirmation(null)
  }

  return (
    <div className="home-scroll">
      <section className="hero">
        <div className="eyebrow"><span /> YOUR QUIET READING SPACE</div>
        <h1>Markdown,<br /><em>beautifully simple.</em></h1>
        <p>Open a document and let the words take center stage.<br />No editing. No clutter. Just reading.</p>
        <button className="primary-button hero-button" disabled={loading} onClick={chooseFile}><FolderOpen size={18} /> {loading ? 'Opening…' : 'Open a Markdown file'}</button>
        <div className="shortcut"><kbd>Ctrl</kbd><span>+</span><kbd>O</kbd><span>to open anytime</span></div>
      </section>

      <section className="recent-section">
        <div className="section-heading">
          <div><p className="section-label">LIBRARY</p><h2>Recently opened</h2></div>
          {totalCount > 0 && <button className="text-button" onClick={() => setConfirmation({ kind: 'clear' })}><Trash2 size={14} /> Clear history</button>}
        </div>

        {totalCount > 3 && (
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recent files…" /></label>
        )}

        {recents.length > 0 ? (
          <div className="recent-grid">
            {recents.map((file, index) => (
              <article className="recent-card" key={file.path} onClick={() => openRecent(file)}>
                <div className={`file-icon file-icon--${index % 3}`}><FileText size={22} /></div>
                <button className="card-menu" title="Remove from history" aria-label={`Remove ${file.name} from history`} onClick={(event) => { event.stopPropagation(); setConfirmation({ kind: 'file', file }) }}><X size={17} /></button>
                <h3>{readableTitle(file.name)}</h3>
                <p className="file-path">{file.path}</p>
                <div className="card-footer"><span><Clock3 size={13} /> {formatRelative(file.openedAt)}</span><span>{formatSize(file.size)}</span></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-illustration"><BookOpen size={34} /><span className="spark spark--one">✦</span><span className="spark spark--two">·</span></div>
            <h3>{query ? 'No matching documents' : 'Your library is waiting'}</h3>
            <p>{query ? 'Try a different search.' : 'Files you open will appear here for quick access.'}</p>
          </div>
        )}
      </section>
      <footer className="home-footer"><Logo /><span>Your files stay on your device. Always.</span></footer>

      {confirmation && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmation(null)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close confirmation" onClick={() => setConfirmation(null)}><X size={18} /></button>
            <div className="modal-icon"><Trash2 size={21} /></div>
            <h3 id="confirm-title">{confirmation.kind === 'clear' ? 'Clear recent history?' : 'Remove from history?'}</h3>
            <p id="confirm-description">
              {confirmation.kind === 'clear'
                ? `This will remove all ${totalCount} recent ${totalCount === 1 ? 'file' : 'files'} from Lumen.`
                : `“${readableTitle(confirmation.file.name)}” will no longer appear in your recent files.`}
              <span>Your Markdown files will not be deleted.</span>
            </p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setConfirmation(null)}>Cancel</button>
              <button className="danger-button" autoFocus onClick={confirmRemoval}>{confirmation.kind === 'clear' ? 'Clear history' : 'Remove'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Logo() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <img className="logo-image logo-image--default" src={`${import.meta.env.BASE_URL}lumen_logo_default.png`} alt="" draggable="false" />
      <img className="logo-image logo-image--light" src={`${import.meta.env.BASE_URL}lumen_logo_light.png`} alt="" draggable="false" />
    </span>
  )
}

const documentElement = window.document.documentElement

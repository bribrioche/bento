import { useEffect, useMemo, useState } from "react";
import { Check, Clipboard, LayoutGrid, List, Moon, MoreHorizontal, Pencil, Plus, Search, Sun, Trash2 } from "lucide-react";
import pastaIcon from "../assets/icon.png";
import type { Note, NoteInput } from "./types";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./components/ui/dropdown-menu";

type Theme = "light" | "dark";
type ViewMode = "grid" | "list";

function NoteDialog({ open, note, onOpenChange, onSave }: {
  open: boolean;
  note: Note | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: NoteInput) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDescription(note?.description ?? "");
    setText(note?.text ?? "");
    setError("");
  }, [open, note]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim() || !text.trim()) { setError("Add both a description and the text to copy."); return; }
    setSaving(true);
    setError("");
    try { await onSave({ description, text }); onOpenChange(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the note."); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{note ? "Edit note" : "Add a note"}</DialogTitle>
            <DialogDescription>Save a useful snippet so it is ready the next time you need it.</DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label><span>Description</span><Input autoFocus maxLength={120} placeholder="e.g. Localhost URL" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label><span>Text to copy</span><Textarea rows={7} maxLength={10000} placeholder="Paste your reusable text here…" value={text} onChange={(event) => setText(event.target.value)} /></label>
            {error && <p className="form-error">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : note ? "Save changes" : "Add note"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function App() {
  const initialTheme = (localStorage.getItem("pasta-theme") as Theme | null) ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [viewMode, setViewMode] = useState<ViewMode>(() => localStorage.getItem("pasta-view") === "list" ? "list" : "grid");
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pasta-theme", theme);
    window.pasta.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("pasta-view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.pasta.listNotes().then(setNotes).catch(() => setError("Your notes could not be loaded.")).finally(() => setLoading(false));
  }, []);

  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => `${note.description} ${note.text}`.toLocaleLowerCase().includes(needle));
  }, [notes, query]);

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(note: Note) { setEditing(note); setDialogOpen(true); }

  async function saveNote(value: NoteInput) {
    if (editing) {
      const updated = await window.pasta.updateNote(editing.id, value);
      setNotes((current) => [updated, ...current.filter((note) => note.id !== updated.id)]);
    } else {
      const created = await window.pasta.createNote(value);
      setNotes((current) => [created, ...current]);
    }
  }

  async function copyNote(note: Note) {
    await window.pasta.copyText(note.text);
    setCopiedId(note.id);
    window.setTimeout(() => setCopiedId((current) => current === note.id ? null : current), 1600);
  }

  async function deleteNote() {
    if (!deleting) return;
    await window.pasta.removeNote(deleting.id);
    setNotes((current) => current.filter((note) => note.id !== deleting.id));
    setDeleting(null);
  }

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="brand"><img className="brand-mark" src={pastaIcon} alt="" /><span>Pasta</span></div>
        <Button className="theme-button" variant="ghost" size="icon" aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </Button>
      </header>

      <main>
        <section className="hero">
          <div><p className="eyebrow">YOUR COPY-PASTE SHELF</p><h1>Keep useful text within reach.</h1><p className="subtitle">Store the lines you use often and copy them in one click.</p></div>
          <Button onClick={openNew}><Plus size={17} />Add note</Button>
        </section>

        <section className="toolbar" aria-label="Note tools">
          <div className="search-control">
            <Search size={18} />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes…" aria-label="Search notes" />
          </div>
          <span>{visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}</span>
          <Button
            variant="outline"
            size="icon"
            title={viewMode === "grid" ? "Use vertical list" : "Use grid"}
            aria-label={viewMode === "grid" ? "Use vertical list" : "Use grid"}
            onClick={() => setViewMode((current) => current === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? <List size={17} /> : <LayoutGrid size={17} />}
          </Button>
        </section>

        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="state"><span className="spinner" />Loading your notes…</div>
        ) : visibleNotes.length ? (
          <section className={`notes-grid ${viewMode === "list" ? "notes-list" : ""}`} aria-label="Notes">
            {visibleNotes.map((note) => (
              <Card key={note.id} className="note-card">
                <div className="note-heading">
                  <h2>{note.description}</h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${note.description}`}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => openEdit(note)}><Pencil size={15} />Edit</DropdownMenuItem>
                      <DropdownMenuItem className="danger-item" onSelect={() => setDeleting(note)}><Trash2 size={15} />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="note-text">{note.text}</p>
                <div className="note-footer"><span>Updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(note.updatedAt))}</span><Button variant={copiedId === note.id ? "default" : "outline"} size="sm" onClick={() => copyNote(note)}>{copiedId === note.id ? <Check size={15} /> : <Clipboard size={15} />}{copiedId === note.id ? "Copied" : "Copy"}</Button></div>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="empty-state"><span className="empty-icon"><Clipboard size={22} /></span><h2>{query ? "No matching notes" : "Your shelf is empty"}</h2><p>{query ? "Try a different search term." : "Add your first reusable line and it will show up here."}</p>{!query && <Button onClick={openNew}><Plus size={17} />Add your first note</Button>}</Card>
        )}
      </main>

      <NoteDialog open={dialogOpen} note={editing} onOpenChange={setDialogOpen} onSave={saveNote} />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this note?</AlertDialogTitle><AlertDialogDescription>“{deleting?.description}” will be permanently removed from Pasta.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" onClick={deleteNote}>Delete note</Button></AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const { app, BrowserWindow, clipboard, ipcMain, nativeTheme } = require("electron");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

let mainWindow;
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

function notesPath() {
  return path.join(app.getPath("userData"), "notes.json");
}

async function readNotes() {
  try {
    const raw = await fs.readFile(notesPath(), "utf8");
    const notes = JSON.parse(raw);
    return Array.isArray(notes) ? notes : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeNotes(notes) {
  const target = notesPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(notes, null, 2), "utf8");
  await fs.rename(temporary, target);
}

function cleanNote(input) {
  const description = String(input?.description ?? "").trim();
  const text = String(input?.text ?? "").trim();
  if (!description) throw new Error("A description is required.");
  if (!text) throw new Error("Text is required.");
  if (description.length > 120) throw new Error("The description is too long.");
  if (text.length > 10000) throw new Error("The text is too long.");
  return { description, text };
}

function registerIpc() {
  ipcMain.handle("notes:list", async () => {
    const notes = await readNotes();
    return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  ipcMain.handle("notes:create", async (_event, input) => {
    const value = cleanNote(input);
    const notes = await readNotes();
    const now = new Date().toISOString();
    const note = { id: crypto.randomUUID(), ...value, createdAt: now, updatedAt: now };
    notes.unshift(note);
    await writeNotes(notes);
    return note;
  });

  ipcMain.handle("notes:update", async (_event, id, input) => {
    const value = cleanNote(input);
    const notes = await readNotes();
    const index = notes.findIndex((note) => note.id === id);
    if (index < 0) throw new Error("This note no longer exists.");
    notes[index] = { ...notes[index], ...value, updatedAt: new Date().toISOString() };
    await writeNotes(notes);
    return notes[index];
  });

  ipcMain.handle("notes:remove", async (_event, id) => {
    const notes = await readNotes();
    const remaining = notes.filter((note) => note.id !== id);
    if (remaining.length === notes.length) throw new Error("This note no longer exists.");
    await writeNotes(remaining);
    return true;
  });

  ipcMain.handle("clipboard:copy", (_event, value) => {
    clipboard.writeText(String(value ?? ""));
    return true;
  });

  ipcMain.handle("window:set-theme", (_event, theme) => {
    nativeTheme.themeSource = theme === "dark" ? "dark" : "light";
    mainWindow?.setTitleBarOverlay({
      color: theme === "dark" ? "#171717" : "#fffaf5",
      symbolColor: theme === "dark" ? "#e7e5e4" : "#292524",
      height: 48,
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 780,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: "#fffaf5",
    title: "Pasta",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#fffaf5", symbolColor: "#292524", height: 48 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDevelopment) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

# Agent Launcher

A small Windows Electron app for saving project folders and opening a terminal in each folder with either Claude or Codex.

## Commands

- **Launch Claude** opens Windows Terminal in the selected folder and runs `claude`.
- **Launch Codex** opens Windows Terminal in the selected folder and runs `codex --yolo`.

If Windows Terminal is unavailable, the app falls back to Windows PowerShell. Folder shortcuts and descriptions are stored locally in Electron's user-data directory; there is no database or cloud sync.

## Development

```powershell
npm install
npm run dev
```

Build the Windows installer with:

```powershell
npm run dist
```

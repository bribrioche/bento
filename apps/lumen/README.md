# Lumen Markdown

A focused desktop Markdown reader built with Electron, React, TypeScript, and Vite.

## Features

- Native Markdown file picker and OS file associations
- Multiple open documents in a lightweight tab strip
- Drag-and-drop Markdown files into the window to open new tabs
- Recent-file history stored as a small local JSON preference
- No database and no document-content cache
- Notion-inspired light and dark themes
- GFM support: tables, task lists, code blocks, and more
- Interactive task-list checkboxes that save directly to the open Markdown file
- Sanitized Markdown output and external links opened in the system browser
- Keyboard shortcut: `Ctrl+O` / `Cmd+O`

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run dist
```

Installers are written to `release/`.

# Bento

Bento is a Windows desktop app that lets people choose, install, and launch a small curated collection of applications from one place.

The built-in catalog currently contains:

- **Lumen** — focused Markdown reading
- **Pasta** — snippets and everyday notes
- **Agent Launcher** — launch coding agents in the right project
- **Pullscope** — pull-request review overview

People can install only the apps they want. Bento detects existing installations and changes each catalog action from **Install** to **Open**. Shortcuts added in the previous Hub app remain available under **Your other apps**.

## Features

- Curated four-app catalog with version and installation status
- Bundled, offline-capable Windows installers in release builds
- Standard-path and Windows registry installation detection
- Launch-or-focus behavior for installed apps
- Custom application shortcuts with editable names and descriptions
- Search, light mode, and dark mode
- Context-isolated Electron renderer

## Requirements

- Windows 10 or newer
- Node.js 20 or newer
- npm

## Development

```powershell
npm ci
npm run dev
```

The development app first looks for installers in `vendor/installers`, then falls back to the neighboring project folders used by the original workspace.

## Build checks

```powershell
npm run check
```

This runs the TypeScript and Vite production build. GitHub Actions runs the same command for pushes and pull requests.

## Creating the Windows installer

The four application installers are intentionally not committed to Git because they total more than 350 MB. Before packaging, place them at:

```text
vendor/installers/
├── lumen/setup.exe
├── pasta/setup.exe
├── agent-launcher/setup.exe
└── pullscope/setup.exe
```

In the original multi-project workspace, this command copies the current installers into those locations automatically:

```powershell
npm run prepare:installers
```

Then create Bento's installer:

```powershell
npm run dist
```

The result is written to `release/Bento Setup 2.0.0.exe`. The release is large because all four installers are embedded for offline use. After a successful build, Bento automatically removes the temporary copies from `vendor/installers` so the source folder stays small. You can also run `npm run clean:installers` manually at any time.

## Project structure

```text
electron/       Electron main process, preload bridge, and focus helper
public/catalog/ Catalog app icons
scripts/        Packaging and installer-preparation helpers
src/            React interface
vendor/         Local installer inputs (executables ignored by Git)
```

## Security notes

- Renderer context isolation and sandboxing are enabled.
- The renderer has no direct Node.js access.
- Only paths selected by the user or defined by the catalog are launched.
- Production dependencies currently report no known npm audit vulnerabilities.
- Locally created Windows builds are unsigned unless a signing certificate is configured, so SmartScreen may display a warning.

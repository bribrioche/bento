# Bento Suite

This folder contains Bento and the complete source for its four catalog apps. Bento can build an app installer on demand, run it, detect the installed application, and open it.

## Start Bento

Install [Node.js 20 or newer](https://nodejs.org/), then double-click `Start Bento.cmd`.

On the first launch, the script installs Bento's development dependencies. In Bento:

1. Select **Build & install** for an app.
2. Bento installs that project's build dependencies if necessary.
3. Bento runs the project's `npm run dist` command.
4. Bento opens the generated Windows installer.
5. After installation, the app action changes to **Open**.

Subsequent builds reuse `node_modules` and any existing installer, so they are faster.

## Folder structure

```text
Bento/
├── Start Bento.cmd
├── bento/                 Bento launcher source
├── apps/
│   ├── lumen/
│   ├── pasta/
│   ├── agent-launcher/
│   └── pullscope/
└── bento-workspace.json   Marker used by Bento to find app sources
```

## Uploading to GitHub

Upload this entire folder. Generated dependencies, builds, and installers are excluded by the root `.gitignore`, so the repository remains small.

Before a manual browser upload, you can return the folder to its source-only state with:

```powershell
npm run clean
```

This removes generated `node_modules`, `dist`, and `release` folders from Bento and all four apps. It never removes source files.

## Build Bento itself

```powershell
npm run setup
npm run build:bento
```

The Bento installer is created under `bento/release`. Keep the extracted suite folder beside the installed or unpacked Bento application when using on-demand app builds.

const fs = require('fs/promises')
const path = require('path')

const root = path.resolve(__dirname, '..')
const workspace = path.resolve(root, '..')
const installers = [
  ['lumen', 'markdown-reader', 'Lumen Markdown Setup 1.0.1.exe'],
  ['pasta', 'pasta', 'Pasta Setup 1.2.1.exe'],
  ['agent-launcher', 'agent-launcher', 'Agent Launcher Setup 1.2.0.exe'],
  ['pullscope', 'pullscope', 'Pullscope Setup 1.4.2.exe'],
]

async function exists(filePath) {
  try { await fs.access(filePath); return true } catch { return false }
}

async function main() {
  const missing = []
  for (const [id, project, filename] of installers) {
    const destination = path.join(root, 'vendor', 'installers', id, 'setup.exe')
    if (await exists(destination)) {
      console.log(`ready  ${id}`)
      continue
    }

    const source = path.join(workspace, project, 'release', filename)
    if (!await exists(source)) {
      missing.push(`${id}: ${source}`)
      continue
    }

    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(source, destination)
    console.log(`copied ${id}`)
  }

  if (missing.length) {
    throw new Error(`Missing installer artifacts:\n${missing.join('\n')}\n\nBuild those apps first, or place each installer at vendor/installers/<app-id>/setup.exe.`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

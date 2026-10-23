const fs = require('fs/promises')
const path = require('path')

const root = path.resolve(__dirname, '..', 'vendor', 'installers')
const appIds = ['lumen', 'pasta', 'agent-launcher', 'pullscope']

async function main() {
  for (const id of appIds) {
    const directory = path.join(root, id)
    const installer = path.join(directory, 'setup.exe')
    await fs.rm(installer, { force: true })
    try { await fs.rmdir(directory) } catch { /* Keep non-empty directories intact. */ }
  }
  console.log('Removed local installer copies from vendor/installers.')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

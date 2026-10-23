const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const projects = [
  path.join(root, 'bento'),
  path.join(root, 'apps', 'lumen'),
  path.join(root, 'apps', 'pasta'),
  path.join(root, 'apps', 'agent-launcher'),
  path.join(root, 'apps', 'pullscope'),
]

const directories = ['node_modules', 'dist', 'release', 'coverage']
const generatedFiles = ['tsconfig.app.tsbuildinfo', 'tsconfig.node.tsbuildinfo', 'vite.config.js', 'vite.config.d.ts']

function safeRemove(target) {
  const resolved = path.resolve(target)
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error(`Refusing to remove a path outside the Bento workspace: ${resolved}`)
  fs.rmSync(resolved, { recursive: true, force: true })
}

for (const project of projects) {
  for (const directory of directories) safeRemove(path.join(project, directory))
  for (const file of generatedFiles) safeRemove(path.join(project, file))
}

console.log('Removed generated dependencies, builds, and installers from the Bento workspace.')

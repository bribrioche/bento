const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const pngToIco = require('png-to-ico').default

async function buildIcon() {
  const root = path.join(__dirname, '..')
  const source = path.join(root, 'public', 'lumen_logo_default.png')
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const buffers = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()))
  fs.writeFileSync(path.join(root, 'public', 'lumen_logo_default.ico'), await pngToIco(buffers))
}

buildIcon().catch((error) => {
  console.error(error)
  process.exit(1)
})

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const pngToIco = require('png-to-ico').default

async function buildIcon() {
  const projectRoot = path.join(__dirname, '..')
  const source = path.join(projectRoot, 'assets', 'bento-icon-source.png')
  const metadata = await sharp(source).metadata()
  const radius = Math.round(metadata.width * 0.125)
  const mask = Buffer.from(`<svg width="${metadata.width}" height="${metadata.height}"><rect width="100%" height="100%" rx="${radius}" fill="white"/></svg>`)
  const icon = await sharp(source).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()

  await sharp(icon).resize(512, 512).png().toFile(path.join(projectRoot, 'assets', 'icon.png'))
  await sharp(icon).resize(256, 256).png().toFile(path.join(projectRoot, 'public', 'icon.png'))

  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const buffers = await Promise.all(sizes.map((size) => sharp(icon).resize(size, size).png().toBuffer()))
  fs.writeFileSync(path.join(projectRoot, 'assets', 'icon.ico'), await pngToIco(buffers))
}

buildIcon().catch((error) => {
  console.error(error)
  process.exit(1)
})

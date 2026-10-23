const path = require('path')
const { rcedit } = require('rcedit')
module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') return
  await rcedit(path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`), { icon: path.join(context.packager.projectDir, 'assets', 'icon.ico') })
}

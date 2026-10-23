const path = require('path')
const { rcedit } = require('rcedit')

module.exports = async function embedWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') return
  const executable = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const icon = path.join(context.packager.projectDir, 'assets', 'icon.ico')
  await rcedit(executable, { icon })
}

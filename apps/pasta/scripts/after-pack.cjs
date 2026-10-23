const path = require("path");
const { rcedit } = require("rcedit");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const executable = path.join(context.appOutDir, "Pasta.exe");
  await rcedit(executable, {
    icon: path.join(context.packager.projectDir, "assets", "icon.ico"),
    "version-string": {
      ProductName: "Pasta",
      FileDescription: "Pasta",
      InternalName: "Pasta",
      OriginalFilename: "Pasta.exe",
    },
  });
};

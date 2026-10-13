const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  const icon = path.join(appPath, 'Contents/Resources/icon.icns');
  if (!fs.existsSync(icon)) return;
  const frameworks = path.join(appPath, 'Contents/Frameworks');
  for (const name of fs.readdirSync(frameworks)) {
    if (!name.endsWith('.app')) continue;
    const contents = path.join(frameworks, name, 'Contents');
    const res = path.join(contents, 'Resources');
    fs.mkdirSync(res, { recursive: true });
    fs.copyFileSync(icon, path.join(res, 'icon.icns'));
    execFileSync('plutil', ['-replace', 'CFBundleIconFile', '-string', 'icon.icns', path.join(contents, 'Info.plist')]);
  }
};

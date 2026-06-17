// Generates build/icon.png (1024) and build/icon.ico from assets/icon.svg.
// electron-builder uses build/icon.ico (Windows) and converts icon.png for mac.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'assets', 'icon.svg');
const buildDir = path.join(root, 'build');

async function main() {
  fs.mkdirSync(buildDir, { recursive: true });
  const svg = fs.readFileSync(svgPath);

  // Master 1024 PNG (used by macOS / Linux builds).
  const png1024 = await sharp(svg).resize(1024, 1024).png().toBuffer();
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png1024);

  // Multi-size ICO for Windows.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs = await Promise.all(
    sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
  );
  const ico = await pngToIco(pngs);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

  console.log('Generated build/icon.png and build/icon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import * as path from 'path';
import * as fs from 'fs';

export async function updateFavicons(logoPath: string): Promise<void> {
  try {
    const sharp = require('sharp');

    // Nginx root: /var/www/feuerwehr-app/frontend/dist
    // Backend läuft in: /var/www/feuerwehr-app/backend/dist/
    // __dirname = .../backend/dist/utils → 3x dirname = /var/www/feuerwehr-app
    const appRoot = path.dirname(path.dirname(path.dirname(__dirname)));
    const distDir = path.join(appRoot, 'frontend', 'dist');
    const targetDir = fs.existsSync(distDir) ? distDir : path.join(appRoot, 'frontend', 'public');

    console.log('[Branding] Favicon-Update in:', targetDir);

    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    for (const size of sizes) {
      const outPath = path.join(targetDir, `icon-${size}x${size}.png`);
      await sharp(logoPath)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toFile(outPath);

      const iconsDir = path.join(targetDir, 'icons');
      if (fs.existsSync(iconsDir)) {
        await sharp(logoPath)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toFile(path.join(iconsDir, `icon-${size}.png`));
      }
    }

    // favicon.ico als 32x32 PNG
    await sharp(logoPath)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toFile(path.join(targetDir, 'favicon.ico'));

    // apple-touch-icon
    await sharp(logoPath)
      .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toFile(path.join(targetDir, 'apple-touch-icon.png'));

    console.log('[Branding] ✅ Favicons aktualisiert in', targetDir);
  } catch (e) {
    console.error('[Branding] Favicon-Update fehlgeschlagen:', e);
  }
}

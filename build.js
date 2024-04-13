import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy files or directories from a given source to a given destination.
async function copy(source, destination) {
  const sourcePath = path.join(__dirname, source);
  const destPath = path.join(__dirname, destination);
  await fs.copy(sourcePath, destPath);
}

// Copy directories and files
const tasks = [
  copy('deps', 'dist/deps'),
  copy('css', 'dist/css'),
	copy('images', 'dist/images'),
	copy('scripts', 'dist/scripts'),
  copy('popup.html', 'dist/popup.html'),
	copy('edit-scripts.html', 'dist/edit-scripts.html'),
	copy('manifest.json', 'dist/manifest.json')
];

Promise.all(tasks).catch(console.error);
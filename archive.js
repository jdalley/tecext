import fs, { createWriteStream, createReadStream } from 'fs';
import archiver from 'archiver';
import path from 'path';
import { fileURLToPath } from 'url';

// Set filename and dirname properties, given we're using ESM not CommonJS.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf-8'));

const output = createWriteStream(`./releases/tecext_${manifest.version}.zip`);
const archive = archiver('zip', {
	zlib: { level: 9 }
});

output.on('close', () => { 
	console.log(archive.pointer() + ' total bytes written.'); 
	console.log(`archiver has been finalized, ${output.path} created.`);
});

output.on('end', () => {
	console.log('Data has been drained');
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    // log warning
  } else {
    // throw error
    throw err;
  }
});

archive.on('error', (err) => {
  throw err;
});


// Grab folders and files from the /dist folder for the archive.
archive.directory(__dirname + '/dist/css', 'css');
archive.directory(__dirname + '/dist/deps', 'deps');
archive.directory(__dirname + '/dist/images', 'images');
archive.directory(__dirname + '/dist/scripts', 'scripts');
archive.glob('*.js', { cwd: __dirname + '/dist' });
archive.glob('*.html', { cwd: __dirname + '/dist' });
archive.append(createReadStream(__dirname + '/dist/manifest.json'), { name: 'manifest.json' });	

archive.pipe(output);
archive.finalize();
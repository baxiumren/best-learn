const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * Zip folder ke output file.
 * @param {string} folder         — folder source
 * @param {string} outputZip      — output zip path
 * @param {Object} options
 * @param {string[]} options.exclude — array nama folder/file yang di-skip (basename match)
 */
function zipFolder(folder, outputZip, options = {}) {
  const { exclude = [] } = options;
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(folder)) {
      return reject(new Error(`Folder not found: ${folder}`));
    }
    fs.mkdirSync(path.dirname(outputZip), { recursive: true });
    const out = fs.createWriteStream(outputZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    let fileCount = 0;
    archive.on('entry', () => fileCount++);
    out.on('close', () => resolve({ size: archive.pointer(), files: fileCount }));
    archive.on('error', reject);
    archive.on('warning', err => {
      if (err.code !== 'ENOENT') reject(err);
    });

    archive.pipe(out);

    // Glob-based directory add dengan exclude filter
    archive.glob('**/*', {
      cwd: folder,
      dot: true,
      ignore: exclude.flatMap(name => [name, `${name}/**`, `**/${name}`, `**/${name}/**`]),
    });

    archive.finalize();
  });
}

module.exports = { zipFolder };

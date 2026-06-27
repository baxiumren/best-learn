const fs = require('fs');
const path = require('path');

/**
 * Manage acfolder input files: domain_target.txt, list_brand.txt, list_image.txt
 * - Read, write, validate, backup
 */

const INPUT_TYPES = {
  targets: { envKey: 'ACFOLDER_TARGETS_FILE', label: 'domain_target.txt', desc: 'Daftar URL target' },
  brands:  { envKey: 'ACFOLDER_BRANDS_FILE',  label: 'list_brand.txt',    desc: 'Daftar nama brand' },
  images:  { envKey: 'ACFOLDER_IMAGES_FILE',  label: 'list_image.txt',    desc: 'Daftar URL gambar' },
};

function resolvePath(type) {
  const cfg = INPUT_TYPES[type];
  if (!cfg) throw new Error(`Unknown input type: ${type}`);
  const env = process.env[cfg.envKey];
  if (!env) throw new Error(`ENV ${cfg.envKey} not set`);
  return path.resolve(__dirname, '..', env);
}

function read(type) {
  const file = resolvePath(type);
  if (!fs.existsSync(file)) return { exists: false, lines: [], content: '' };
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return { exists: true, lines, content, file };
}

function backup(type) {
  const file = resolvePath(type);
  if (!fs.existsSync(file)) return null;
  const backupDir = path.resolve(__dirname, '..', process.env.ACFOLDER_ROOT || '../acfolder', '_backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = path.basename(file).replace(/\.txt$/, `_${ts}.txt`);
  const dest = path.join(backupDir, name);
  fs.copyFileSync(file, dest);
  return dest;
}

function write(type, content) {
  const file = resolvePath(type);
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });

  // Backup old file
  const backupPath = backup(type);

  // Normalize line endings (LF), trim, drop empty
  const normalized = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n') + '\n';

  fs.writeFileSync(file, normalized, 'utf-8');
  return {
    file,
    backupPath,
    lineCount: normalized.trim().split('\n').length,
  };
}

function append(type, content) {
  const current = read(type);
  const combined = (current.content.trimEnd() + '\n' + content).trim();
  return write(type, combined);
}

/**
 * Validate consistency: brand count == image count == target count
 */
function validateAll() {
  const t = read('targets');
  const b = read('brands');
  const i = read('images');

  const issues = [];
  if (!t.exists) issues.push('domain_target.txt missing');
  if (!b.exists) issues.push('list_brand.txt missing');
  if (!i.exists) issues.push('list_image.txt missing');

  if (t.exists && b.exists && t.lines.length !== b.lines.length) {
    issues.push(`Mismatch: ${t.lines.length} targets vs ${b.lines.length} brands`);
  }
  if (b.exists && i.exists && b.lines.length !== i.lines.length) {
    issues.push(`Mismatch: ${b.lines.length} brands vs ${i.lines.length} images`);
  }

  return {
    targets: t.lines.length,
    brands: b.lines.length,
    images: i.lines.length,
    ok: issues.length === 0,
    issues,
  };
}

/**
 * Detect duplicate entries dalam content.
 * Return: { hasDuplicates, duplicates: [{ entry, lineNumbers: [...] }], uniqueCount, totalCount }
 */
function detectDuplicates(content) {
  const lines = content
    .split(/\r?\n/)
    .map((l, idx) => ({ value: l.trim(), lineNumber: idx + 1 }))
    .filter(x => x.value); // skip empty lines

  const seen = new Map(); // value -> [lineNumbers]
  for (const { value, lineNumber } of lines) {
    if (!seen.has(value)) seen.set(value, []);
    seen.get(value).push(lineNumber);
  }

  const duplicates = [];
  for (const [value, lineNumbers] of seen.entries()) {
    if (lineNumbers.length > 1) {
      duplicates.push({ entry: value, lineNumbers, count: lineNumbers.length });
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
    uniqueCount: seen.size,
    totalCount: lines.length,
  };
}

/**
 * Cek duplicate antara content baru vs file existing
 * Return: { hasOverlap, overlap: [...] }
 */
function detectOverlapWithExisting(type, newContent) {
  const existing = read(type);
  if (!existing.exists || existing.lines.length === 0) {
    return { hasOverlap: false, overlap: [] };
  }
  const existingSet = new Set(existing.lines);
  const newLines = newContent
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const overlap = newLines.filter(l => existingSet.has(l));
  return {
    hasOverlap: overlap.length > 0,
    overlap: [...new Set(overlap)], // dedupe overlap list itself
  };
}

module.exports = {
  INPUT_TYPES,
  read,
  write,
  append,
  backup,
  validateAll,
  resolvePath,
  detectDuplicates,
  detectOverlapWithExisting,
};

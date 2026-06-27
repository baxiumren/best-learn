const fs = require('fs');
const path = require('path');

/**
 * File editor module — handles all acfolder file modifications.
 * Auto-backup before any write.
 */

function resolveEnv(key, fallback) {
  const env = process.env[key];
  if (!env) return path.resolve(__dirname, '..', fallback);
  return path.resolve(__dirname, '..', env);
}

const PATHS = {
  ping: () => resolveEnv('ACFOLDER_PING_FILE', '../ping.php'),
  robots: () => resolveEnv('ACFOLDER_ROBOTS_FILE', '../robots.txt'),
  template: () => resolveEnv('ACFOLDER_TEMPLATE_FILE', '../template.php'),
  templateAmp: () => resolveEnv('ACFOLDER_TEMPLATE_AMP_FILE', '../template_amp.php'),
  stockDir: () => resolveEnv('ACFOLDER_STOCK_TEMPLATE_DIR', '../stock_template'),
  stockAmpDir: () => resolveEnv('ACFOLDER_STOCK_AMP_DIR', '../stock_amp'),
  indexPhp: () => resolveEnv('ACFOLDER_INDEX_FILE', '../index.php'),
  sitemapDomainFile: () => resolveEnv('ACFOLDER_SITEMAP_DOMAIN_FILE', '../sitemapgenerator/sitemap_domain.txt'),
  sitemapOutput: () => resolveEnv('ACFOLDER_SITEMAP_OUTPUT', '../sitemapgenerator/sitemap.xml'),
  acfolderRoot: () => resolveEnv('ACFOLDER_ROOT', '..'),
};

function backupFile(file) {
  if (!fs.existsSync(file)) return null;
  const backupDir = path.join(PATHS.acfolderRoot(), '_backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const dest = path.join(backupDir, `${base}_${ts}${ext}`);
  fs.copyFileSync(file, dest);
  return dest;
}

function writeWithBackup(file, content) {
  const backup = backupFile(file);
  fs.writeFileSync(file, content, 'utf-8');
  return { file, backup };
}

// ============================================
// DOMAIN — update ping.php + robots.txt
// ============================================

function normalizeDomain(input) {
  let d = input.trim();
  if (!d) throw new Error('Domain empty');
  if (!/^https?:\/\//.test(d)) d = 'https://' + d;
  if (!d.endsWith('/')) d += '/';
  // Validate
  try { new URL(d); } catch { throw new Error('Invalid domain format'); }
  return d;
}

function setDomain(domainInput) {
  const domain = normalizeDomain(domainInput);
  const domainNoSlash = domain.slice(0, -1); // https://domain.com
  const sitemapUrl = domain + 'sitemap.xml';
  const results = [];

  // 1. Update ping.php
  const pingFile = PATHS.ping();
  if (fs.existsSync(pingFile)) {
    let content = fs.readFileSync(pingFile, 'utf-8');
    // Replace: $your_sitemap_url = "..."
    const re = /\$your_sitemap_url\s*=\s*["'][^"']*["']\s*;/;
    if (re.test(content)) {
      content = content.replace(re, `$your_sitemap_url = "${sitemapUrl}";`);
      writeWithBackup(pingFile, content);
      results.push({ file: 'ping.php', status: 'updated', value: sitemapUrl });
    } else {
      results.push({ file: 'ping.php', status: 'pattern not found' });
    }
  } else {
    results.push({ file: 'ping.php', status: 'not exist' });
  }

  // 2. Update robots.txt
  const robotsFile = PATHS.robots();
  if (fs.existsSync(robotsFile)) {
    let content = fs.readFileSync(robotsFile, 'utf-8');
    const re = /^Sitemap:\s*\S+/im;
    if (re.test(content)) {
      content = content.replace(re, `Sitemap:${sitemapUrl}`);
    } else {
      // Append if missing
      content = content.trimEnd() + `\n\nSitemap:${sitemapUrl}\n`;
    }
    writeWithBackup(robotsFile, content);
    results.push({ file: 'robots.txt', status: 'updated', value: sitemapUrl });
  } else {
    results.push({ file: 'robots.txt', status: 'not exist' });
  }

  return { domain, sitemapUrl, results };
}

function getCurrentDomain() {
  // Coba ambil dari robots.txt
  const robotsFile = PATHS.robots();
  if (fs.existsSync(robotsFile)) {
    const content = fs.readFileSync(robotsFile, 'utf-8');
    const m = content.match(/^Sitemap:\s*(\S+)/im);
    if (m) {
      const url = m[1];
      try {
        const u = new URL(url);
        return `${u.protocol}//${u.hostname}/`;
      } catch {}
    }
  }
  return null;
}

// ============================================
// TEMPLATE PICKER
// ============================================

function listStockTemplates() {
  const dir = PATHS.stockDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.php')).sort();
}

function listStockAmpTemplates() {
  const dir = PATHS.stockAmpDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(php|html)$/i.test(f)).sort();
}

function pickTemplate(filename) {
  const src = path.join(PATHS.stockDir(), filename);
  if (!fs.existsSync(src)) throw new Error(`Template not found: ${filename}`);
  const dst = PATHS.template();
  backupFile(dst);
  fs.copyFileSync(src, dst);
  return { src, dst, filename };
}

function pickAmpTemplate(filename) {
  const src = path.join(PATHS.stockAmpDir(), filename);
  if (!fs.existsSync(src)) throw new Error(`AMP template not found: ${filename}`);
  const dst = PATHS.templateAmp();
  backupFile(dst);
  fs.copyFileSync(src, dst);
  return { src, dst, filename };
}

// ============================================
// TITLE & DESCRIPTION editor
// Strategy: extract current title/desc dari <title> dan <meta name="description">,
// terus replaceAll occurrence text-nya (case-sensitive) di seluruh file.
// ============================================

function extractTitle(content) {
  const m = content.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractDescription(content) {
  // meta name="description" content="..."
  const m = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return m ? m[1].trim() : null;
}

function getTitleDesc() {
  const out = { template: {}, templateAmp: {} };
  for (const key of ['template', 'templateAmp']) {
    const file = key === 'template' ? PATHS.template() : PATHS.templateAmp();
    if (!fs.existsSync(file)) {
      out[key] = { exists: false };
      continue;
    }
    const c = fs.readFileSync(file, 'utf-8');
    out[key] = {
      exists: true,
      title: extractTitle(c),
      desc: extractDescription(c),
    };
  }
  return out;
}

function replaceAllInFile(file, oldText, newText) {
  if (!fs.existsSync(file)) return { file, changed: false, reason: 'not exist' };
  let content = fs.readFileSync(file, 'utf-8');
  if (!oldText || !content.includes(oldText)) {
    return { file, changed: false, reason: 'old text not found' };
  }
  const count = content.split(oldText).length - 1;
  content = content.split(oldText).join(newText);
  writeWithBackup(file, content);
  return { file, changed: true, count };
}

function setTitle(newTitle) {
  if (!newTitle.includes('{BRAND}')) {
    throw new Error('Title harus mengandung {BRAND}');
  }
  const results = [];
  for (const file of [PATHS.template(), PATHS.templateAmp()]) {
    if (!fs.existsSync(file)) {
      results.push({ file: path.basename(file), changed: false, reason: 'not exist' });
      continue;
    }
    const content = fs.readFileSync(file, 'utf-8');
    const current = extractTitle(content);
    if (!current) {
      results.push({ file: path.basename(file), changed: false, reason: 'no <title> found' });
      continue;
    }
    const r = replaceAllInFile(file, current, newTitle);
    results.push({ file: path.basename(file), ...r, oldText: current, newText: newTitle });
  }
  return results;
}

function setDescription(newDesc) {
  if (!newDesc.includes('{BRAND}')) {
    throw new Error('Description harus mengandung {BRAND}');
  }
  const results = [];
  for (const file of [PATHS.template(), PATHS.templateAmp()]) {
    if (!fs.existsSync(file)) {
      results.push({ file: path.basename(file), changed: false, reason: 'not exist' });
      continue;
    }
    const content = fs.readFileSync(file, 'utf-8');
    const current = extractDescription(content);
    if (!current) {
      results.push({ file: path.basename(file), changed: false, reason: 'no description meta found' });
      continue;
    }
    const r = replaceAllInFile(file, current, newDesc);
    results.push({ file: path.basename(file), ...r, oldText: current, newText: newDesc });
  }
  return results;
}

// ============================================
// ASSETS — edit $config['defaults'] di index.php
// ============================================

const ASSET_KEYS = ['FAVICON', 'LOGO_BRAND', 'AMP_URL', 'MONEY_SITE', 'LOGO', 'AMP_IMAGE'];

function readAssets() {
  const file = PATHS.indexPhp();
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, 'utf-8');
  const assets = {};
  for (const key of ASSET_KEYS) {
    const re = new RegExp(`'${key}'\\s*=>\\s*['"]([^'"]*)['"]`);
    const m = content.match(re);
    assets[key] = m ? m[1] : null;
  }
  return assets;
}

function writeAsset(key, value) {
  if (!ASSET_KEYS.includes(key)) throw new Error(`Invalid asset key: ${key}`);
  const file = PATHS.indexPhp();
  if (!fs.existsSync(file)) throw new Error('index.php not found');
  let content = fs.readFileSync(file, 'utf-8');
  const re = new RegExp(`('${key}'\\s*=>\\s*)['"][^'"]*['"]`);
  if (!re.test(content)) throw new Error(`Asset ${key} pattern not found in index.php`);
  content = content.replace(re, `$1'${value}'`);
  writeWithBackup(file, content);
  return { key, value };
}

function writeAssetsBulk(updates) {
  const results = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) continue;
    try {
      writeAsset(key, value);
      results.push({ key, value, ok: true });
    } catch (e) {
      results.push({ key, value, ok: false, error: e.message });
    }
  }
  return results;
}

// ============================================
// SITEMAP GENERATOR — copy domain_target.txt → sitemap_domain.txt
// ============================================

function copyTargetsToSitemap() {
  const targets = resolveEnv('ACFOLDER_TARGETS_FILE', '../domain_target.txt');
  const dest = PATHS.sitemapDomainFile();
  if (!fs.existsSync(targets)) throw new Error('domain_target.txt not found');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  backupFile(dest);
  fs.copyFileSync(targets, dest);
  const lineCount = fs.readFileSync(targets, 'utf-8').split(/\r?\n/).filter(l => l.trim()).length;
  return { source: targets, dest, lineCount };
}

function readSitemapOutput() {
  const file = PATHS.sitemapOutput();
  if (!fs.existsSync(file)) return null;
  return {
    file,
    content: fs.readFileSync(file, 'utf-8'),
    size: fs.statSync(file).size,
    modified: fs.statSync(file).mtime,
  };
}

module.exports = {
  PATHS,
  // Domain
  setDomain, getCurrentDomain, normalizeDomain,
  // Templates
  listStockTemplates, listStockAmpTemplates, pickTemplate, pickAmpTemplate,
  // Title/desc
  getTitleDesc, setTitle, setDescription, extractTitle, extractDescription,
  // Assets
  ASSET_KEYS, readAssets, writeAsset, writeAssetsBulk,
  // Sitemap
  copyTargetsToSitemap, readSitemapOutput,
};

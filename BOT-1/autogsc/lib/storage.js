const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '..', 'bot-data', 'domains');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function domainDir(domain) {
  return path.join(DATA_ROOT, domain);
}

function saveDomainData(domain, config, sitemapXml) {
  const dir = domainDir(domain);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), sitemapXml);
  fs.writeFileSync(path.join(dir, 'prefixes.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({
    createdAt: Date.now(),
    addedProperties: [],
    verifiedProperties: [],
    indexedUrls: [],
  }, null, 2));
}

function loadDomainData(domain) {
  const dir = domainDir(domain);
  const file = path.join(dir, 'prefixes.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function loadStatus(domain) {
  const file = path.join(domainDir(domain), 'status.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function updateStatus(domain, patch) {
  const current = loadStatus(domain) || {};
  const next = { ...current, ...patch, updatedAt: Date.now() };
  fs.writeFileSync(path.join(domainDir(domain), 'status.json'), JSON.stringify(next, null, 2));
}

function listDomains() {
  if (!fs.existsSync(DATA_ROOT)) return [];
  return fs.readdirSync(DATA_ROOT).filter(name => {
    const stat = fs.statSync(path.join(DATA_ROOT, name));
    return stat.isDirectory();
  });
}

/**
 * Delete domain completely — sitemap, prefixes, GSC files, zip, everything.
 */
function deleteDomain(domain) {
  const dir = domainDir(domain);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

/**
 * Delete only GSC files & zip (keep sitemap + config). Use before /prepare again.
 */
function cleanGscFiles(domain) {
  const dir = domainDir(domain);
  const gscDir = path.join(dir, 'gsc-files');
  const zipFile = path.join(dir, 'gsc-files.zip');
  if (fs.existsSync(gscDir)) fs.rmSync(gscDir, { recursive: true, force: true });
  if (fs.existsSync(zipFile)) fs.rmSync(zipFile, { force: true });
}

/**
 * Delete EVERYTHING (all domains). Nuclear option.
 */
function deleteAllDomains() {
  if (!fs.existsSync(DATA_ROOT)) return 0;
  const domains = listDomains();
  for (const d of domains) deleteDomain(d);
  return domains.length;
}

module.exports = {
  DATA_ROOT,
  domainDir,
  saveDomainData,
  loadDomainData,
  loadStatus,
  updateStatus,
  listDomains,
  deleteDomain,
  cleanGscFiles,
  deleteAllDomains,
};

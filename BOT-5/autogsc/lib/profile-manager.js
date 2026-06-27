const fs = require('fs');
const path = require('path');

/**
 * Multi-profile manager untuk Chrome session.
 *
 * Struktur folder:
 *   chrome-profiles/
 *     _active.txt          ← berisi nama profile aktif
 *     default/             ← profile default (auto-create)
 *     gmail1/
 *     gmail2/
 *     gmail3/
 *
 * Switch profile = ubah _active.txt → next Chrome launch pakai folder itu.
 */

const ROOT = path.resolve(__dirname, '..', 'chrome-profiles');
const ACTIVE_FILE = path.join(ROOT, '_active.txt');
const LEGACY_PROFILE = path.resolve(__dirname, '..', 'chrome-profile'); // pre-multi version

function ensureRoot() {
  fs.mkdirSync(ROOT, { recursive: true });
}

function sanitizeName(name) {
  return String(name).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
}

/**
 * Migration: kalau ada folder 'chrome-profile' (legacy single-profile),
 * pindahin ke 'chrome-profiles/default' otomatis.
 */
function autoMigrateLegacy() {
  ensureRoot();
  const defaultPath = path.join(ROOT, 'default');
  if (fs.existsSync(LEGACY_PROFILE) && !fs.existsSync(defaultPath)) {
    try {
      fs.renameSync(LEGACY_PROFILE, defaultPath);
      setActive('default');
      console.log('✅ Migrated legacy chrome-profile/ → chrome-profiles/default/');
    } catch (e) {
      console.error('⚠️  Legacy migration failed:', e.message);
    }
  }
}

function listProfiles() {
  ensureRoot();
  return fs.readdirSync(ROOT)
    .filter(name => {
      if (name.startsWith('_') || name.startsWith('.')) return false;
      const p = path.join(ROOT, name);
      try { return fs.statSync(p).isDirectory(); } catch { return false; }
    })
    .sort();
}

function getActive() {
  ensureRoot();
  if (fs.existsSync(ACTIVE_FILE)) {
    const name = fs.readFileSync(ACTIVE_FILE, 'utf-8').trim();
    if (name) return name;
  }
  // Default: pakai 'default' kalo ada, atau profile pertama, atau 'default' (akan auto-create)
  const list = listProfiles();
  if (list.includes('default')) return 'default';
  if (list.length > 0) return list[0];
  return 'default';
}

function setActive(name) {
  const clean = sanitizeName(name);
  if (!clean) throw new Error('Invalid profile name');
  ensureRoot();
  fs.writeFileSync(ACTIVE_FILE, clean, 'utf-8');
  // Ensure folder exists
  fs.mkdirSync(path.join(ROOT, clean), { recursive: true });
  return clean;
}

function createProfile(name) {
  const clean = sanitizeName(name);
  if (!clean) throw new Error('Invalid profile name');
  ensureRoot();
  const p = path.join(ROOT, clean);
  if (fs.existsSync(p)) {
    return { name: clean, path: p, created: false };
  }
  fs.mkdirSync(p, { recursive: true });
  return { name: clean, path: p, created: true };
}

function deleteProfile(name) {
  const clean = sanitizeName(name);
  if (!clean) throw new Error('Invalid profile name');
  if (clean === 'default') throw new Error('Profile "default" tidak boleh dihapus');
  const p = path.join(ROOT, clean);
  if (!fs.existsSync(p)) return false;
  fs.rmSync(p, { recursive: true, force: true });
  // Kalo yang dihapus = active, reset ke default
  if (getActive() === clean) {
    setActive('default');
    fs.mkdirSync(path.join(ROOT, 'default'), { recursive: true });
  }
  return true;
}

function getActivePath() {
  autoMigrateLegacy();
  const active = getActive();
  const p = path.join(ROOT, active);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function getProfileInfo() {
  const profiles = listProfiles();
  const active = getActive();
  return {
    profiles,
    active,
    activePath: path.join(ROOT, active),
    total: profiles.length,
  };
}

module.exports = {
  ROOT,
  ensureRoot,
  autoMigrateLegacy,
  listProfiles,
  getActive,
  setActive,
  createProfile,
  deleteProfile,
  getActivePath,
  getProfileInfo,
};

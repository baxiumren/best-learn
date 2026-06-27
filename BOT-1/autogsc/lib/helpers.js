const inputs = require('./inputs-manager');

/**
 * Wrap async fn dengan per-domain lock (anti double-run).
 */
function withLock(locks, domain, fn) {
  return async (ctx) => {
    if (locks.has(domain)) return ctx.reply(`⏳ Domain ${domain} masih diproses. Tunggu dulu.`);
    locks.add(domain);
    try { await fn(ctx); }
    finally { locks.delete(domain); }
  };
}

/**
 * Resolve argument ke key INPUT_TYPES (targets/brands/images) — support alias.
 */
function getTypeFromArg(arg) {
  if (!arg) return null;
  const t = arg.toLowerCase();
  if (['targets', 'target', 'domain', 'domains'].includes(t)) return 'targets';
  if (['brands', 'brand'].includes(t)) return 'brands';
  if (['images', 'image', 'img'].includes(t)) return 'images';
  return null;
}

module.exports = { withLock, getTypeFromArg };

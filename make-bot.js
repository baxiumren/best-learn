#!/usr/bin/env node
/**
 * make-bot.js — Scaffold bot instance terisolasi di dalam acfolder-2.
 *
 * Tiap bot = 1 folder lengkap (konten acfolder + autogsc) dengan:
 *   - PHP_PORT sendiri  (localhost beda → situs beda)
 *   - TELEGRAM_TOKEN sendiri
 *   - chrome-profiles/ & bot-data/ FRESH (Google/akun beda, data tidak tabrakan)
 *
 * CARA PAKAI (jalankan dari folder acfolder-2):
 *   node make-bot.js BOT-1 3031 <TELEGRAM_TOKEN>
 *   node make-bot.js BOT-2 3032 <TELEGRAM_TOKEN>
 *
 *   # batch bikin sekaligus (BOT-1..BOT-N, port mulai 3031, token placeholder):
 *   node make-bot.js all 5
 *   node make-bot.js all 5 3031
 *
 * Token boleh dikosongkan dulu → diisi placeholder "ISI_TOKEN_<BOT>",
 * tinggal edit <BOT>/autogsc/.env belakangan.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = __dirname; // folder acfolder-2

// Folder/file yang TIDAK ikut di-copy (relative ke SOURCE, pakai '/')
const EXCLUDE = [
  'make-bot.js',                       // script ini sendiri
  '_backups',                          // backup acfolder
  'zreqautogsc',                       // tool python terpisah (berat), tidak dibutuhkan bot
  'stock_template',                    // SHARED → dipakai bareng dari acfolder-2 (tidak di-copy)
  'stock_amp',                         // SHARED → dipakai bareng dari acfolder-2 (tidak di-copy)
  'autogsc/chrome-profiles',           // profile harus FRESH per bot
  'autogsc/chrome-profile-uploader',   // profile uploader, fresh
  'autogsc/bot-data',                  // data domain, fresh per bot
  'autogsc/.wrangler',                 // cache cloudflare
  'autogsc/_debug',                    // screenshot debug
  'autogsc/bot.js.backup',             // backup lama
];

function relPosix(abs) {
  return path.relative(SOURCE, abs).split(path.sep).join('/');
}

function isExcluded(abs) {
  const rel = relPosix(abs);
  if (rel === '') return false;
  // skip semua folder bot yang sudah ada (BOT-*) biar tidak rekursif
  if (/^BOT-/i.test(rel)) return true;
  for (const ex of EXCLUDE) {
    if (rel === ex || rel.startsWith(ex + '/')) return true;
  }
  return false;
}

function setEnv(envPath, port, token) {
  let env = fs.readFileSync(envPath, 'utf-8');
  const genUrl = `http://localhost:${port}/`;
  const sitemapUrl = `http://localhost:${port}/sitemapgenerator/sitemap_generator.php`;

  const repl = (re, line) => {
    if (re.test(env)) env = env.replace(re, line);
    else env += `\n${line}`;
  };
  repl(/^TELEGRAM_TOKEN=.*$/m,            `TELEGRAM_TOKEN=${token}`);
  repl(/^PHP_PORT=.*$/m,                  `PHP_PORT=${port}`);
  repl(/^ACFOLDER_GENERATOR_URL=.*$/m,    `ACFOLDER_GENERATOR_URL=${genUrl}`);
  repl(/^ACFOLDER_SITEMAP_GEN_URL=.*$/m,  `ACFOLDER_SITEMAP_GEN_URL=${sitemapUrl}`);
  // Template library SHARED dari acfolder-2 (../../ dari folder autogsc)
  repl(/^ACFOLDER_STOCK_TEMPLATE_DIR=.*$/m, `ACFOLDER_STOCK_TEMPLATE_DIR=../../stock_template`);
  repl(/^ACFOLDER_STOCK_AMP_DIR=.*$/m,      `ACFOLDER_STOCK_AMP_DIR=../../stock_amp`);

  fs.writeFileSync(envPath, env);
}

function makeOne(botName, port, token) {
  if (!/^BOT-/i.test(botName)) {
    console.error(`❌ Nama bot harus diawali "BOT-" (mis. BOT-1). Diberikan: ${botName}`);
    process.exitCode = 1;
    return false;
  }
  const target = path.join(SOURCE, botName);
  if (fs.existsSync(target)) {
    console.error(`⚠️  ${botName} sudah ada — dilewati (hapus manual dulu kalau mau rebuild).`);
    return false;
  }

  console.log(`📦 ${botName}: copy konten...`);
  fs.mkdirSync(target, { recursive: true });
  // Copy per-entry top-level (hindari error "copy into itself" karena target di dalam SOURCE)
  for (const entry of fs.readdirSync(SOURCE)) {
    const srcEntry = path.join(SOURCE, entry);
    if (isExcluded(srcEntry)) continue;
    fs.cpSync(srcEntry, path.join(target, entry), {
      recursive: true,
      filter: (src) => !isExcluded(src),
    });
  }

  // .env per bot
  const envPath = path.join(target, 'autogsc', '.env');
  if (!fs.existsSync(envPath)) {
    console.error(`❌ ${botName}: autogsc/.env tidak ketemu setelah copy.`);
    return false;
  }
  setEnv(envPath, port, token);

  // folder fresh
  fs.mkdirSync(path.join(target, 'autogsc', 'bot-data'), { recursive: true });
  fs.mkdirSync(path.join(target, 'autogsc', 'chrome-profiles'), { recursive: true });

  console.log(`✅ ${botName} siap → PHP_PORT=${port}, TOKEN=${token}`);
  return true;
}

// ===== CLI =====
const [a, b, c] = process.argv.slice(2);

if (!a) {
  console.log(`Usage:
  node make-bot.js <BOT-NAME> <PORT> [TOKEN]
  node make-bot.js all <COUNT> [START_PORT]

Contoh:
  node make-bot.js BOT-1 3031 123456:ABC
  node make-bot.js all 5            # BOT-1..BOT-5, port 3031..3035, token placeholder`);
  process.exit(0);
}

if (a.toLowerCase() === 'all') {
  const count = parseInt(b, 10);
  const startPort = parseInt(c, 10) || 3031;
  if (!count || count < 1) { console.error('❌ COUNT harus angka ≥ 1'); process.exit(1); }
  let made = 0;
  for (let i = 1; i <= count; i++) {
    const name = `BOT-${i}`;
    const port = startPort + (i - 1);
    if (makeOne(name, port, `ISI_TOKEN_${name}`)) made++;
  }
  console.log(`\n🎉 ${made}/${count} bot dibuat.`);
  console.log(`\n👉 Langkah berikutnya per bot:`);
  console.log(`   1. Edit <BOT>/autogsc/.env → ganti TELEGRAM_TOKEN (dari @BotFather)`);
  console.log(`   2. cd <BOT>/autogsc && npm start`);
  console.log(`   3. Login Gmail BEDA di tiap bot saat diminta`);
} else {
  const botName = a;
  const port = parseInt(b, 10);
  const token = c || `ISI_TOKEN_${botName}`;
  if (!port) { console.error('❌ PORT wajib & harus angka. Contoh: node make-bot.js BOT-1 3031'); process.exit(1); }
  if (makeOne(botName, port, token)) {
    console.log(`\n👉 Next:`);
    console.log(`   1. (kalau token placeholder) edit ${botName}/autogsc/.env → TELEGRAM_TOKEN`);
    console.log(`   2. cd ${botName}/autogsc && npm start`);
  }
}

const fs = require('fs');
const path = require('path');
const {
  loadDomainData,
  loadStatus,
  listDomains,
  deleteDomain,
  cleanGscFiles,
  deleteAllDomains,
} = require('../lib/storage');
const paths = require('../config/paths');

function clearFolderContents(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    fs.rmSync(p, { recursive: true, force: true });
    count++;
  }
  return count;
}

/**
 * Utility: /list, /status, /delete, /cleanfiles, /reset
 */
module.exports = function registerUtility(bot) {

  bot.command('list', (ctx) => {
    const domains = listDomains();
    if (domains.length === 0) return ctx.reply('ℹ️ *Belum Ada Domain*\n\nJalankan `/scan` dulu.', { parse_mode: 'Markdown' });

    let txt = `📋 *Domains (${domains.length})*\n\n`;
    domains.forEach((d, i) => {
      const status = loadStatus(d) || {};
      const cfg = loadDomainData(d);
      const verified = status.verifiedProperties?.length || 0;
      const indexed = status.indexedUrls?.length || 0;
      const total = cfg?.totalUrls || 0;
      txt += `${i + 1}. \`${d}\`\n   📁 ${verified}/${cfg?.prefixes?.length || 0} verified · 🚀 ${indexed}/${total} indexed\n`;
    });

    ctx.reply(txt, { parse_mode: 'Markdown' });
  });

  bot.command('status', (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/status domain.com`', { parse_mode: 'Markdown' });

    const cfg = loadDomainData(domain);
    const status = loadStatus(domain);
    if (!cfg) return ctx.reply(`❌ *Tidak Ditemukan*\n\nDomain \`${domain}\` not found.`, { parse_mode: 'Markdown' });

    let txt = `📊 *Status: \`${domain}\`*\n\n`;
    txt += `• 📂 Prefixes  : ${cfg.prefixes.length}\n`;
    txt += `• 📄 Total URL : ${cfg.totalUrls}\n`;
    txt += `• ✅ Added     : ${status?.addedProperties?.length || 0}\n`;
    txt += `• 🔐 Verified  : ${status?.verifiedProperties?.length || 0}\n`;
    txt += `• 🚀 Indexed   : ${status?.indexedUrls?.length || 0}\n`;
    if (status?.lastIndexAt) {
      txt += `• 🕒 Last index : \`${new Date(status.lastIndexAt).toLocaleString()}\`\n`;
    }

    ctx.reply(txt, { parse_mode: 'Markdown' });
  });

  bot.command('delete', (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/delete domain.com`', { parse_mode: 'Markdown' });

    const ok = deleteDomain(domain);
    ctx.reply(ok
      ? `✅ *Deleted*\n\nDomain \`${domain}\` dihapus (sitemap + GSC files + status).`
      : `❌ *Tidak Ditemukan*\n\nDomain \`${domain}\` not found.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('cleanfiles', (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/cleanfiles domain.com`', { parse_mode: 'Markdown' });

    cleanGscFiles(domain);
    ctx.reply(`✅ *Cleaned*\n\n🧹 GSC files & zip untuk \`${domain}\` dibersihkan.\n_(sitemap & config tetap aman)_`, { parse_mode: 'Markdown' });
  });

  bot.command('reset', (ctx) => {
    const count = deleteAllDomains();
    ctx.reply(`✅ *Reset*\n\n💣 \`${count}\` domain(s) deleted.`, { parse_mode: 'Markdown' });
  });

  bot.command('clearresult', (ctx) => {
    const arg = ctx.message.text.split(/\s+/)[1];

    if (arg !== 'confirm') {
      const templateDir = paths.ACFOLDER_RESULT_PATH;
      const ampDir      = path.dirname(paths.ACFOLDER_AMP_RESULT_PATH);
      const zipsDir     = paths.ZIPS_DIR;

      const countDir = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;

      return ctx.reply(
        `🗑️ *Clear Result Folders*\n\n` +
        `Akan dihapus ISI dari:\n` +
        `• \`template_result/\` — ${countDir(templateDir)} item\n` +
        `• \`amp_result/\` — ${countDir(ampDir)} item\n` +
        `• \`_zips/\` — ${countDir(zipsDir)} item\n\n` +
        `⚠️ *Tidak bisa di-undo!* Yakin mau hapus semua?`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
          [{ text: '✅ Ya, Hapus Semua', callback_data: 'run:clearresult confirm' }],
          [{ text: '❌ Batal',           callback_data: 'menu:utility'            }],
        ]}}
      );
    }

    // Eksekusi hapus
    const templateDir = paths.ACFOLDER_RESULT_PATH;
    const ampDir      = path.dirname(paths.ACFOLDER_AMP_RESULT_PATH);
    const zipsDir     = paths.ZIPS_DIR;

    const t = clearFolderContents(templateDir);
    const a = clearFolderContents(ampDir);
    const z = clearFolderContents(zipsDir);

    ctx.reply(
      `✅ *Clear Result Done*\n\n` +
      `🗑️ \`template_result/\` — ${t} item dihapus\n` +
      `🗑️ \`amp_result/\` — ${a} item dihapus\n` +
      `🗑️ \`_zips/\` — ${z} item dihapus\n\n` +
      `Folder tetap ada, isinya kosong.`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
        { text: '🧰 Utility',   callback_data: 'menu:utility' },
        { text: '🏠 Menu Utama', callback_data: 'menu:main'   },
      ]]}}
    );
  });
};

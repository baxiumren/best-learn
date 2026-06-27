const {
  loadDomainData,
  loadStatus,
  listDomains,
  deleteDomain,
  cleanGscFiles,
  deleteAllDomains,
} = require('../lib/storage');

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
};

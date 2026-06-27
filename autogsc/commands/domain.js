const editor = require('../lib/file-editor');
const state = require('../lib/state');

/**
 * Domain setup: /setdomain, /showdomain
 */
module.exports = function registerDomain(bot) {
  bot.command('showdomain', (ctx) => {
    const d = editor.getCurrentDomain();
    if (!d) return ctx.reply('⚠️ *Domain belum di-set*\n\n👉 Next: jalankan `/setdomain` dulu.', { parse_mode: 'Markdown' });
    ctx.reply(`🌐 *Current Domain*\n\n• Domain : \`${d}\`\n\n👉 Next: \`/setdomain\` buat ubah.`, { parse_mode: 'Markdown' });
  });

  bot.command('setdomain', (ctx) => {
    state.promptState.set(ctx.from.id, { kind: 'set-domain' });
    const curr = editor.getCurrentDomain();
    ctx.reply(
      `🌐 *Set Domain*\n\n` +
      (curr ? `• Current : \`${curr}\`\n\n` : '') +
      `Kirim domain dengan format:\n\`https://domain.com/\`\n\n` +
      `Akan auto-update:\n• \`ping.php\` (sitemap URL)\n• \`robots.txt\` (Sitemap line)\n\n` +
      `👉 Next: kirim domain, atau \`/cancel\``,
      { parse_mode: 'Markdown' }
    );
  });
};

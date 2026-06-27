const editor = require('../lib/file-editor');
const state = require('../lib/state');

/**
 * Domain setup: /setdomain, /showdomain
 */
module.exports = function registerDomain(bot) {
  bot.command('showdomain', (ctx) => {
    const d = editor.getCurrentDomain();
    if (!d) return ctx.reply('⚠️ *Domain belum di-set*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '⚙️ Set Domain Sekarang', callback_data: 'run:setdomain' },
      ]]}
    });
    ctx.reply(`🌐 *Current Domain*\n\n• Domain : \`${d}\``, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[
        { text: '⚙️ Ganti Domain', callback_data: 'run:setdomain' },
        { text: '🏠 Menu Utama',   callback_data: 'menu:main'     },
      ]]}
    });
  });

  bot.command('setdomain', (ctx) => {
    state.promptState.set(ctx.from.id, { kind: 'set-domain' });
    const curr = editor.getCurrentDomain();
    ctx.reply(
      `🌐 *Set Domain*\n\n` +
      (curr ? `• Current : \`${curr}\`\n\n` : '') +
      `Kirim domain dengan format:\n\`https://domain.com/\`\n\n` +
      `Akan auto-update:\n• \`ping.php\` (sitemap URL)\n• \`robots.txt\` (Sitemap line)`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
        { text: '❌ Cancel', callback_data: 'run:cancel' }
      ]]}}
    );
  });
};

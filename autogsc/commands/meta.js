const editor = require('../lib/file-editor');
const state = require('../lib/state');

/**
 * Title & Description: /showtitle, /edittitle, /showdesc, /editdesc
 */
module.exports = function registerMeta(bot) {
  bot.command('showtitle', (ctx) => {
    const data = editor.getTitleDesc();
    let msg = `📰 *Current Title*\n\n`;
    msg += `• \`template.php\` :\n\`${data.template.title || '(none)'}\`\n\n`;
    msg += `• \`template_amp.php\` :\n\`${data.templateAmp.title || '(none)'}\``;
    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('edittitle', (ctx) => {
    state.promptState.set(ctx.from.id, { kind: 'edit-title' });
    const data = editor.getTitleDesc();
    ctx.reply(
      `📰 *Edit Title*\n\n` +
      `• Current (\`template.php\`) :\n\`${data.template.title || '(none)'}\`\n\n` +
      `Kirim title baru. *WAJIB include \`{BRAND}\`* placeholder.\n\n` +
      `💡 Contoh:\n\`Bergabung Di {BRAND} - Slot Online Terpercaya\`\n\n👉 Next: \`/cancel\` buat batal.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('showdesc', (ctx) => {
    const data = editor.getTitleDesc();
    let msg = `📝 *Current Description*\n\n`;
    msg += `• \`template.php\` :\n\`${data.template.desc || '(none)'}\`\n\n`;
    msg += `• \`template_amp.php\` :\n\`${data.templateAmp.desc || '(none)'}\``;
    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('editdesc', (ctx) => {
    state.promptState.set(ctx.from.id, { kind: 'edit-desc' });
    const data = editor.getTitleDesc();
    ctx.reply(
      `📝 *Edit Description*\n\n` +
      `• Current (\`template.php\`) :\n\`${data.template.desc || '(none)'}\`\n\n` +
      `Kirim deskripsi baru. *WAJIB include \`{BRAND}\`*.\n\n👉 Next: \`/cancel\` buat batal.`,
      { parse_mode: 'Markdown' }
    );
  });
};

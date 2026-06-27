const editor = require('../lib/file-editor');
const state = require('../lib/state');

/**
 * Template picker: /picktemplate (LP), /pickamp (AMP)
 */
module.exports = function registerTemplate(bot) {
  bot.command('picktemplate', (ctx) => {
    const list = editor.listStockTemplates();
    if (list.length === 0) return ctx.reply('⚠️ *Folder Kosong*\n\n• Folder : `stock_template/` kosong.', { parse_mode: 'Markdown' });
    state.promptState.set(ctx.from.id, { kind: 'pick-template', list });
    let msg = `📑 *Pilih Template (Landing Page)*\n\n`;
    list.forEach((f, i) => { msg += `• ${i + 1}. \`${f}\`\n`; });
    msg += `\nKirim angka (\`1\`-\`${list.length}\`) atau nama file:`;
    ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
      { text: '❌ Cancel', callback_data: 'run:cancel' }
    ]]}});
  });

  bot.command('pickamp', (ctx) => {
    const list = editor.listStockAmpTemplates();
    if (list.length === 0) return ctx.reply('⚠️ *Folder Kosong*\n\n• Folder : `stock_amp/` kosong.', { parse_mode: 'Markdown' });
    state.promptState.set(ctx.from.id, { kind: 'pick-amp', list });
    let msg = `📱 *Pilih Template (AMP)*\n\n`;
    list.forEach((f, i) => { msg += `• ${i + 1}. \`${f}\`\n`; });
    msg += `\nKirim angka (\`1\`-\`${list.length}\`) atau nama file:`;
    ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
      { text: '❌ Cancel', callback_data: 'run:cancel' }
    ]]}});
  });
};

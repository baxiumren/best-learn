const editor = require('../lib/file-editor');
const state = require('../lib/state');

/**
 * Helper: ask next asset in wizard.
 * Exported supaya text-handler bisa panggil setelah user submit value.
 */
function askNextAsset(ctx) {
  const st = state.promptState.get(ctx.from.id);
  if (!st || st.kind !== 'set-assets') return;
  if (st.step >= editor.ASSET_KEYS.length) {
    // Done — apply
    const results = editor.writeAssetsBulk(st.updates);
    state.promptState.delete(ctx.from.id);
    let msg = `✅ *Assets Updated*\n\n`;
    if (results.length === 0) {
      msg += `ℹ️ _(no changes)_`;
    } else {
      results.forEach(r => {
        msg += `${r.ok ? '✅' : '❌'} • \`${r.key}\` : \`${r.value}\`\n`;
        if (!r.ok) msg += `   ⚠️ _${r.error}_\n`;
      });
    }
    return ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
      { text: '⬅️ Menu Utama', callback_data: 'menu:main' },
    ]]}});
  }
  const key = editor.ASSET_KEYS[st.step];
  const cur = st.current[key] || '(empty)';
  ctx.reply(
    `🎨 *[${st.step + 1}/${editor.ASSET_KEYS.length}] ${key}*\n\n` +
    `• Current : \`${cur}\`\n\nKirim URL baru:`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
      { text: '⏭️ Skip (pakai yg lama)', callback_data: 'run:skip'   },
      { text: '❌ Cancel',               callback_data: 'run:cancel' },
    ]]}}
  );
}

/**
 * Assets wizard: /showassets, /setassets, /skip
 */
module.exports = function registerAssets(bot) {
  bot.command('showassets', (ctx) => {
    const a = editor.readAssets();
    if (!a) return ctx.reply('❌ *Not Found*\n\n• File : `index.php` tidak ditemukan.', { parse_mode: 'Markdown' });
    let msg = `🎨 *Current Assets* (\`index.php\` defaults)\n\n`;
    for (const k of editor.ASSET_KEYS) {
      msg += `• *${k}* :\n\`${a[k] || '(empty)'}\`\n\n`;
    }
    ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  bot.command('setassets', (ctx) => {
    const curr = editor.readAssets() || {};
    state.promptState.set(ctx.from.id, {
      kind: 'set-assets',
      step: 0,
      current: curr,
      updates: {},
    });
    askNextAsset(ctx);
  });

  bot.command('skip', (ctx) => {
    const st = state.promptState.get(ctx.from.id);
    if (st?.kind !== 'set-assets') return ctx.reply('⚠️ *Gak Ada Wizard Aktif*\n\nGak ada wizard `setassets` yang sedang berjalan.', { parse_mode: 'Markdown' });
    st.step++;
    askNextAsset(ctx);
  });
};

// Export helper buat dipanggil dari text-handler
module.exports.askNextAsset = askNextAsset;

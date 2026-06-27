const editor = require('../lib/file-editor');
const state = require('../lib/state');
const { askNextAsset } = require('./assets');

/**
 * bot.on('text') — handle prompt + editing buffer (cross-cut beberapa command).
 * Harus didaftarin SETELAH semua command supaya text command tetap di-routing dulu.
 */
module.exports = function registerTextHandler(bot) {
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return next?.();

    // promptState handlers (single-shot prompts)
    const ps = state.promptState.get(ctx.from.id);
    if (ps) {
      try {
        if (ps.kind === 'set-domain') {
          const r = editor.setDomain(text);
          state.promptState.delete(ctx.from.id);
          let msg = `✅ *Domain Set*\n\n• 🌐 Domain  : \`${r.domain}\`\n• 📍 Sitemap : \`${r.sitemapUrl}\`\n\n`;
          r.results.forEach(x => { msg += `• \`${x.file}\` : _${x.status}_\n`; });
          return ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
            { text: '2️⃣ Domain Setup', callback_data: 'menu:domain' },
            { text: '🏠 Menu Utama',   callback_data: 'menu:main'   },
          ]]}});
        }

        if (ps.kind === 'pick-template' || ps.kind === 'pick-amp') {
          const idx = parseInt(text, 10);
          let chosen = isNaN(idx) ? text.trim() : ps.list[idx - 1];
          if (!chosen) return ctx.reply('❌ *Pilihan Invalid*\n\nCoba lagi atau tekan Cancel.', {
            parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
              { text: '❌ Cancel', callback_data: 'run:cancel' },
            ]]}
          });
          state.promptState.delete(ctx.from.id);
          const fn = ps.kind === 'pick-template' ? editor.pickTemplate : editor.pickAmpTemplate;
          const target = ps.kind === 'pick-template' ? 'template.php' : 'template_amp.php';
          const r = fn(chosen);
          return ctx.reply(`✅ *Copied*\n\n\`${r.filename}\` → \`${target}\``, {
            parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
              { text: '3️⃣ Template', callback_data: 'menu:template' },
              { text: '🏠 Menu Utama', callback_data: 'menu:main'   },
            ]]}
          });
        }

        if (ps.kind === 'edit-title') {
          const results = editor.setTitle(text);
          state.promptState.delete(ctx.from.id);
          let msg = `✅ *Title Updated*\n\n• New : \`${text}\`\n\n`;
          results.forEach(r => {
            msg += `${r.changed ? '✅' : '⚠️'} \`${r.file}\``;
            if (r.changed) msg += ` (${r.count} occurrences)\n`;
            else msg += `: _${r.reason}_\n`;
          });
          return ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
            { text: '4️⃣ Title & Desc', callback_data: 'menu:meta' },
            { text: '🏠 Menu Utama',   callback_data: 'menu:main' },
          ]]}});
        }

        if (ps.kind === 'edit-desc') {
          const results = editor.setDescription(text);
          state.promptState.delete(ctx.from.id);
          let msg = `✅ *Description Updated*\n\n• New : \`${text}\`\n\n`;
          results.forEach(r => {
            msg += `${r.changed ? '✅' : '⚠️'} \`${r.file}\``;
            if (r.changed) msg += ` (${r.count} occurrences)\n`;
            else msg += `: _${r.reason}_\n`;
          });
          return ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
            { text: '4️⃣ Title & Desc', callback_data: 'menu:meta' },
            { text: '🏠 Menu Utama',   callback_data: 'menu:main' },
          ]]}});
        }

        if (ps.kind === 'set-assets') {
          const key = editor.ASSET_KEYS[ps.step];
          ps.updates[key] = text.trim();
          ps.step++;
          return askNextAsset(ctx);
        }
      } catch (e) {
        state.promptState.delete(ctx.from.id);
        return ctx.reply(`❌ *Error*\n\n${e.message}`, { parse_mode: 'Markdown' });
      }
    }

    // editingState handlers (multi-line buffer for input files)
    const editing = state.editingState.get(ctx.from.id);
    if (!editing) return next?.();
    editing.buffer.push(text);
    ctx.reply(`📥 Buffered ${editing.buffer.length} message(s). Ketik \`/done\` kalo udah selesai.`, { parse_mode: 'Markdown' });
  });
};

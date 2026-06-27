const path = require('path');
const axios = require('axios');
const inputs = require('../lib/inputs-manager');
const state = require('../lib/state');
const { getTypeFromArg } = require('../lib/helpers');

/**
 * Input file management: show/check/edit/append/upload/done/cancel + document handler.
 */
module.exports = function registerInputs(bot) {
  bot.command('show', (ctx) => {
    const type = getTypeFromArg(ctx.message.text.split(/\s+/)[1]);
    if (!type) return ctx.reply('ℹ️ *Format*\n\n`/show <targets|brands|images>`', { parse_mode: 'Markdown' });

    const data = inputs.read(type);
    if (!data.exists) return ctx.reply(`❌ *File belum ada*\n\n• File : \`${inputs.INPUT_TYPES[type].label}\``, { parse_mode: 'Markdown' });

    const preview = data.lines.slice(0, 30).join('\n');
    const more = data.lines.length > 30 ? `\n\n(... +${data.lines.length - 30} lebih)` : '';
    ctx.reply(
      `📄 *${inputs.INPUT_TYPES[type].label}* (${data.lines.length} baris)\n\n${preview}${more}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('check', (ctx) => {
    const result = inputs.validateAll();
    let txt = `🔍 *Input Validation*\n\n`;
    txt += `📄 • Targets : \`${result.targets}\` URL\n`;
    txt += `🏷️ • Brands  : \`${result.brands}\` brand\n`;
    txt += `🖼️ • Images  : \`${result.images}\` URL\n\n`;
    if (result.ok) {
      txt += `✅ *Semua sinkron* (\`${result.targets}\` entries)\n\n`;
      txt += `💡 Siap di-generate lewat \`acfolder\`!`;
    } else {
      txt += `⚠️ *Ada masalah:*\n`;
      result.issues.forEach(i => txt += `• ${i}\n`);
    }
    ctx.reply(txt, { parse_mode: 'Markdown' });
  });

  bot.command('edit', (ctx) => {
    const type = getTypeFromArg(ctx.message.text.split(/\s+/)[1]);
    if (!type) return ctx.reply('ℹ️ *Format*\n\n`/edit <targets|brands|images>`\n\nSetelah itu paste isi baru (1 entry per baris). Akhiri dengan `/done` atau `/cancel`.', { parse_mode: 'Markdown' });

    state.editingState.set(ctx.from.id, { type, mode: 'edit', buffer: [] });
    ctx.reply(
      `✏️ *Editing ${inputs.INPUT_TYPES[type].label}*\n\n` +
      `Paste isi baru — boleh multi-line, boleh multi-message.\n\n` +
      `👉 Next: ketik \`/done\` buat save (replace), \`/cancel\` buat batal.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('append', (ctx) => {
    const type = getTypeFromArg(ctx.message.text.split(/\s+/)[1]);
    if (!type) return ctx.reply('ℹ️ *Format*\n\n`/append <targets|brands|images>`', { parse_mode: 'Markdown' });

    state.editingState.set(ctx.from.id, { type, mode: 'append', buffer: [] });
    ctx.reply(
      `➕ *Appending to ${inputs.INPUT_TYPES[type].label}*\n\n` +
      `Kirim baris baru (boleh multi-message).\n\n👉 Next: ketik \`/done\` buat save, \`/cancel\` buat batal.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('done', (ctx) => {
    const editing = state.editingState.get(ctx.from.id);
    if (!editing) return ctx.reply('⚠️ *Gak ada session editing aktif*', { parse_mode: 'Markdown' });
    state.editingState.delete(ctx.from.id);

    const content = editing.buffer.join('\n');
    if (!content.trim()) return ctx.reply('⚠️ *Buffer kosong, gak save.*', { parse_mode: 'Markdown' });

    try {
      const fn = editing.mode === 'append' ? inputs.append : inputs.write;
      const result = fn(editing.type, content);
      let msg = `✅ *Saved!*\n\n`;
      msg += `📄 • File  : \`${inputs.INPUT_TYPES[editing.type].label}\`\n`;
      msg += `📄 • Total : \`${result.lineCount}\` baris\n`;
      if (result.backupPath) msg += `💾 • Backup : \`${path.basename(result.backupPath)}\`\n`;
      msg += `\n💡 Jalankan \`/check\` buat validasi sinkronisasi.`;
      ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) {
      ctx.reply(`❌ *Save Error*\n\n• Pesan : \`${e.message}\``, { parse_mode: 'Markdown' });
    }
  });

  bot.command('cancel', (ctx) => {
    state.editingState.delete(ctx.from.id);
    state.uploadingState.delete(ctx.from.id);
    state.promptState.delete(ctx.from.id);
    ctx.reply('✅ *Cancelled*', { parse_mode: 'Markdown' });
  });

  bot.command('upload', (ctx) => {
    const type = getTypeFromArg(ctx.message.text.split(/\s+/)[1]);
    if (!type) return ctx.reply('ℹ️ *Format*\n\n`/upload <targets|brands|images>`\n\nSetelah itu, kirim file `.txt` sebagai dokumen Telegram.', { parse_mode: 'Markdown' });

    state.uploadingState.set(ctx.from.id, { type });
    ctx.reply(
      `📤 *Waiting for upload: ${inputs.INPUT_TYPES[type].label}*\n\n` +
      `Kirim file \`.txt\` sebagai dokumen sekarang.\n_(file lama akan di-backup auto)_\n\n👉 Next: kirim file, atau \`/cancel\``,
      { parse_mode: 'Markdown' }
    );
  });

  // Handle uploaded document — cek duplikat dalam file
  bot.on('document', async (ctx) => {
    const uploading = state.uploadingState.get(ctx.from.id);
    if (!uploading) return; // bukan kontex upload

    try {
      const file = ctx.message.document;
      const fileLink = await ctx.telegram.getFileLink(file.file_id);
      // timeout 30s biar handler gak nge-hang (download Telegram kadang lambat/diblokir ISP)
      // → kalau hang tanpa timeout, polling bot ikut macet (semua /command jadi diam)
      const { data } = await axios.get(fileLink.href, { responseType: 'text', timeout: 30000 });

      // CEK DUPLIKAT DI DALAM FILE
      const dupCheck = inputs.detectDuplicates(data);
      if (dupCheck.hasDuplicates) {
        const typeLabel = inputs.INPUT_TYPES[uploading.type].label;
        let msg = `⚠️ *Duplikat ditemukan di file upload!*\n\n`;
        msg += `📄 • File     : \`${typeLabel}\`\n`;
        msg += `📊 • Total    : \`${dupCheck.totalCount}\` baris, unik: \`${dupCheck.uniqueCount}\`\n`;
        msg += `🔴 • Duplikat : *${dupCheck.duplicates.length}* entry\n\n`;

        const showLimit = 10;
        const toShow = dupCheck.duplicates.slice(0, showLimit);
        msg += `*Daftar duplikat:*\n`;
        for (const d of toShow) {
          msg += `• \`${d.entry}\`\n  ↳ muncul *${d.count}×* di baris ${d.lineNumbers.join(', ')}\n`;
        }
        if (dupCheck.duplicates.length > showLimit) {
          msg += `\n_+${dupCheck.duplicates.length - showLimit} duplikat lainnya..._\n`;
        }

        msg += `\n💡 *Action:* Ganti link/entry duplikat dengan yang baru & unik, lalu \`/upload ${uploading.type}\` ulang.`;
        return ctx.reply(msg, { parse_mode: 'Markdown' });
      }

      // AMAN, OVERWRITE FILE
      state.uploadingState.delete(ctx.from.id);
      const result = inputs.write(uploading.type, data);
      let msg = `✅ *Uploaded!*\n\n`;
      msg += `📄 • File  : \`${inputs.INPUT_TYPES[uploading.type].label}\`\n`;
      msg += `📄 • Total : \`${result.lineCount}\` baris (semua unik ✨)\n`;
      if (result.backupPath) msg += `💾 • Backup : \`${path.basename(result.backupPath)}\`\n`;
      msg += `\n💡 Pakai \`/check\` buat validasi.`;
      ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) {
      state.uploadingState.delete(ctx.from.id);
      ctx.reply(`❌ *Upload Error*\n\n• Pesan : \`${e.message}\``, { parse_mode: 'Markdown' });
    }
  });
};

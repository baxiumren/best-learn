const path = require('path');
const fs = require('fs');
const axios = require('axios');
const inputs = require('../lib/inputs-manager');
const editor = require('../lib/file-editor');
const paths = require('../config/paths');

/**
 * /generate — trigger acfolder PHP generator
 * /gensitemap — copy targets, trigger PHP generator, return XML
 */
module.exports = function registerGenerate(bot) {
  // /generate
  bot.command('generate', async (ctx) => {
    if (!paths.ACFOLDER_GENERATOR_URL) {
      return ctx.reply(
        `❌ *Config Belum Lengkap*\n\n` +
        `• \`ACFOLDER_GENERATOR_URL\` belum di-set di \`.env\`\n\n` +
        `Set ke URL acfolder \`index.php\`.\n\n` +
        `💡 Atau run manual lewat browser, lalu balik ke sini buat \`/scantargets\`.`,
        { parse_mode: 'Markdown' }
      );
    }

    const valid = inputs.validateAll();
    if (!valid.ok) {
      return ctx.reply(
        `⚠️ *Input Belum Valid*\n\n${valid.issues.map(i => `• ${i}`).join('\n')}\n\n💡 Fix dulu sebelum generate.`,
        { parse_mode: 'Markdown' }
      );
    }

    const msg = await ctx.reply(`🔨 *Triggering acfolder generator...*\n_(${paths.ACFOLDER_GENERATOR_URL})_`, { parse_mode: 'Markdown' });
    try {
      const form = new URLSearchParams({ generate: '1' }).toString();
      const res = await axios.post(paths.ACFOLDER_GENERATOR_URL, form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 60000,
        maxRedirects: 0,
        validateStatus: () => true,
      });

      const html = res.data || '';
      let resultMsg = '';
      const matchSuccess = html.match(/<div class="message success">([^<]+)</);
      const matchError = html.match(/<div class="message error">([^<]+)</);
      if (matchSuccess) resultMsg = `✅ ${matchSuccess[1].trim()}`;
      else if (matchError) resultMsg = `❌ ${matchError[1].trim()}`;
      else resultMsg = `📋 HTTP ${res.status} (cek hasilnya di folder result/)`;

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
        `🔨 *Generator Done*\n\n${resultMsg}\n\n👉 Next: \`/scantargets\` lalu \`/prepareinto <domain>\``,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
        `❌ *Trigger Error*\n\n• \`${e.message}\`\n\n💡 Pastikan XAMPP/web server jalan.`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  // /gensitemap
  bot.command('gensitemap', async (ctx) => {
    const msg = await ctx.reply('🗺️ *Generating sitemap...*', { parse_mode: 'Markdown' });
    try {
      const cp = editor.copyTargetsToSitemap();

      const url = paths.ACFOLDER_SITEMAP_GEN_URL;
      let phpStatus = 'skipped (no ACFOLDER_SITEMAP_GEN_URL)';
      if (url) {
        try {
          const res = await axios.get(url, { timeout: 30000 });
          phpStatus = `HTTP ${res.status}`;
        } catch (e) {
          phpStatus = `error: ${e.message}`;
        }
      }

      const out = editor.readSitemapOutput();

      let report = `✅ *Sitemap Generation*\n\n`;
      report += `• Copied   : \`${path.basename(cp.dest)}\` (${cp.lineCount} URL)\n`;
      report += `• PHP gen  : \`${phpStatus}\`\n`;
      if (out) {
        report += `• Output   : \`${path.basename(out.file)}\`\n`;
        report += `• Size     : \`${(out.size / 1024).toFixed(1)} KB\`\n`;
        report += `• Modified : \`${out.modified.toLocaleString()}\`\n`;
      } else {
        report += `• Output   : ⚠️ gak ditemukan\n`;
      }
      report += `\n💡 Upload \`sitemap.xml\` ke root domain biar Google bisa baca.`;
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });

      // Attach sitemap.xml file
      if (out) {
        await ctx.replyWithDocument({ source: out.file, filename: 'sitemap.xml' });
      }
    } catch (e) {
      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `❌ *Error*\n\n• \`${e.message}\``, { parse_mode: 'Markdown' });
    }
  });
};

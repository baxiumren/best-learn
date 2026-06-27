const axios = require('axios');
const { analyzeSitemap } = require('../lib/analyzer');
const { saveDomainData, deleteDomain } = require('../lib/storage');

/**
 * /scan <sitemap_url> — analyze sitemap & save domain config.
 */
module.exports = function registerScan(bot) {
  bot.command('scan', async (ctx) => {
    const sitemapUrl = ctx.message.text.split(/\s+/)[1];
    if (!sitemapUrl) return ctx.reply('ℹ️ *Format*\n\n`/scan https://domain.com/sitemap.xml`', { parse_mode: 'Markdown' });

    const msg = await ctx.reply('🔍 *Fetching & analyzing sitemap...*', { parse_mode: 'Markdown' });
    try {
      const { data } = await axios.get(sitemapUrl, { timeout: 30000 });
      const result = await analyzeSitemap(data);

      // Cleanup old data sebelum save (re-scan = fresh start)
      deleteDomain(result.domain);
      saveDomainData(result.domain, result, data);

      let report = `✅ *Analysis Report*\n\n`;
      report += `🌐 • Domain             : \`${result.domain}\`\n`;
      report += `📄 • Total URL          : *${result.totalUrls}*\n`;
      report += `📂 • Prefixes           : *${result.prefixes.length}*\n`;
      report += `📁 • GSC files needed   : *${result.prefixes.length}*\n`;
      report += `⚡ • Daily quota        : *${result.prefixes.length * 10}* URL/hari\n`;
      report += `📅 • Days to index all  : *${Math.ceil(result.totalUrls / (result.prefixes.length * 10))}*\n\n`;
      report += `*Detected prefixes:*\n`;
      result.prefixes.forEach((p, i) => {
        const count = (result.urlsByPrefix[p] || []).length;
        report += `${i + 1}. \`${p}\` — ${count} URL\n`;
      });
      report += `\n👉 Next: \`/prepare ${result.domain}\``;

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });
    } catch (e) {
      await ctx.reply(`❌ *Scan Error*\n\n• Pesan : \`${e.message}\``, { parse_mode: 'Markdown' });
    }
  });
};

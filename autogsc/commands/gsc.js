const fs = require('fs');
const path = require('path');
const { parseTargetsFile, parseSitemapFile, prefixToFolderPath } = require('../lib/targets-parser');
const {
  saveDomainData,
  loadDomainData,
  loadStatus,
  updateStatus,
  deleteDomain,
  cleanGscFiles,
  domainDir,
} = require('../lib/storage');
const {
  downloadVerificationFiles,
  verifyProperties,
  requestIndexAll,
  verifyAndIndexAll,
} = require('../lib/chrome-worker');
const { zipFolder } = require('../lib/zipper');
const state = require('../lib/state');
const { withLock } = require('../lib/helpers');
const paths = require('../config/paths');
const editor = require('../lib/file-editor');

/**
 * GSC pipeline commands: scantargets, prepareinto, ready, cancellogin, prepare, verify, index
 */
module.exports = function registerGsc(bot) {

  // /scantargets — baca sitemap.xml (output dari /gensitemap)
  bot.command('scantargets', async (ctx) => {
    const useSitemap = fs.existsSync(paths.ACFOLDER_SITEMAP_OUTPUT);
    const sourceFile = useSitemap ? paths.ACFOLDER_SITEMAP_OUTPUT : paths.ACFOLDER_TARGETS_FILE;
    const sourceLabel = useSitemap ? 'sitemap.xml' : 'domain_target.txt';

    if (!fs.existsSync(sourceFile)) {
      return ctx.reply(
        `❌ Source not found.\n\n` +
        `Sitemap: \`${paths.ACFOLDER_SITEMAP_OUTPUT}\`\n` +
        `Targets: \`${paths.ACFOLDER_TARGETS_FILE}\`\n\n` +
        `💡 Run \`/gensitemap\` dulu untuk generate sitemap.xml.`,
        { parse_mode: 'Markdown' }
      );
    }

    const msg = await ctx.reply(`🔍 Reading ${sourceLabel}...`);
    try {
      const byDomain = useSitemap
        ? parseSitemapFile(paths.ACFOLDER_SITEMAP_OUTPUT)
        : parseTargetsFile(paths.ACFOLDER_TARGETS_FILE);
      const domains = Object.keys(byDomain);

      if (domains.length === 0) {
        return ctx.telegram.editMessageText(
          ctx.chat.id, msg.message_id, null,
          `❌ No valid URLs found in ${sourceLabel}`
        );
      }

      for (const d of domains) {
        const cfg = byDomain[d];
        deleteDomain(d);
        saveDomainData(d, { ...cfg, source: useSitemap ? 'sitemap' : 'targets' }, JSON.stringify(cfg, null, 2));
      }

      let report = `📊 *Targets Analysis* (hierarchical prefix)\n\n`;
      report += `📄 Source: \`${sourceLabel}\`${useSitemap ? ' ✨' : ''}\n`;
      report += `🌐 Domains found: *${domains.length}*\n\n`;

      for (const d of domains) {
        const cfg = byDomain[d];
        report += `*${d}*\n`;
        report += `  • ${cfg.totalUrls} URL → *${cfg.prefixes.length} property* (max 10 URL/property)\n`;
        report += `  • Quota: ${cfg.prefixes.length * 10} URL/hari\n`;
        const prefixList = cfg.prefixes.slice(0, 8);
        for (const p of prefixList) {
          const urlCount = (cfg.urlsByPrefix[p] || []).length;
          report += `  ◦ \`${p}\` (${urlCount} URL)\n`;
        }
        if (cfg.prefixes.length > 8) {
          report += `  ◦ ... +${cfg.prefixes.length - 8} more prefix\n`;
        }
        report += `\n`;
      }

      report += `👉 Next: \`/prepareinto <domain>\``;
      if (domains.length === 1) report += `\nExample: \`/prepareinto ${domains[0]}\``;

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });
    } catch (e) {
      await ctx.reply(`❌ *Error*\n\n• \`${e.message}\``, { parse_mode: 'Markdown' });
    }
  });

  // /ready — confirm user udah login Google manual
  bot.command('ready', async (ctx) => {
    const lr = state.loginReadyState.get(ctx.from.id);
    if (!lr) {
      return ctx.reply('ℹ️ Gak ada session yang nunggu login. Run `/prepareinto <domain>` dulu.', { parse_mode: 'Markdown' });
    }
    clearTimeout(lr.timeoutHandle);
    state.loginReadyState.delete(ctx.from.id);
    lr.resolve();
    await ctx.reply('✅ *Ready confirmed!* Lanjut download GSC files...', { parse_mode: 'Markdown' });
  });

  // /cancellogin — batalin login wait
  bot.command(['cancellogin', 'cancel-login'], async (ctx) => {
    const lr = state.loginReadyState.get(ctx.from.id);
    if (!lr) {
      return ctx.reply('ℹ️ *Tidak Ada Session*\n\nGak ada session login yang aktif.', { parse_mode: 'Markdown' });
    }
    clearTimeout(lr.timeoutHandle);
    state.loginReadyState.delete(ctx.from.id);
    lr.reject?.(new Error('User cancelled login'));
    await ctx.reply('🚫 Login dibatalkan. Bot stop processing.');
  });

  // /prepareinto — ambil domain UTAMA dari /setdomain, download 1 file verifikasi root ke result/template_result/
  // Property root (https://domain.com/) otomatis mencakup semua subpath, jadi cukup 1 file.
  bot.command('prepareinto', async (ctx) => {
    // Ambil domain utama dari /setdomain (dibaca dari robots.txt) → "https://domain.com/"
    const currentDomain = editor.getCurrentDomain();
    if (!currentDomain) {
      return ctx.reply('❌ *Domain Belum Di-set*\n\n👉 Next: `/setdomain` dulu.', { parse_mode: 'Markdown' });
    }

    let host;
    try {
      host = new URL(currentDomain).hostname; // "domain.com"
    } catch {
      return ctx.reply(`❌ Domain tidak valid: ${currentDomain}`);
    }

    if (!fs.existsSync(paths.ACFOLDER_RESULT_PATH)) {
      return ctx.reply(
        `❌ Folder belum ada: \`${paths.ACFOLDER_RESULT_PATH}\`\n\n` +
        `Generate landing page dulu lewat acfolder (run index.php), baru jalanin command ini.`,
        { parse_mode: 'Markdown' }
      );
    }

    // Reply cepet biar Telegram gak timeout 90s
    await ctx.reply(
      `🤖 Opening Chrome — ambil kode verifikasi domain utama...\n` +
      `🌐 Property: \`https://${host}/\`\n` +
      `📁 Output: \`${paths.ACFOLDER_RESULT_PATH}\`\n` +
      `_(kalau belum login Google, bot bakal kasih notif untuk kirim /ready)_`,
      { parse_mode: 'Markdown' }
    );

    // FIRE-AND-FORGET — biar handler return cepet
    withLock(state.locks, host, async () => {
      const msg = await ctx.reply(`🚀 Starting...`);
      let lastEdit = 0;

      const onLoginRequired = async () => {
        await ctx.reply(
          `🔐 *LOGIN GOOGLE DIPERLUKAN*\n\n` +
          `1️⃣ Chrome udah kebuka di layar lu\n` +
          `2️⃣ Login Google manual (akun yang punya akses GSC)\n` +
          `3️⃣ Setelah dashboard GSC kebuka, kirim \`/ready\` di Telegram\n\n` +
          `⏱️ Bot bakal tunggu max 10 menit.\n` +
          `❌ Ketik \`/cancellogin\` kalau mau batalkan.`,
          { parse_mode: 'Markdown' }
        );
      };

      const waitReady = () => new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          state.loginReadyState.delete(ctx.from.id);
          reject(new Error('Login timeout 10 menit. /prepareinto dibatalkan.'));
        }, 10 * 60 * 1000);
        state.loginReadyState.set(ctx.from.id, { resolve, reject, timeoutHandle });
      });

      // Cukup 1 property root '/' → 1 file verifikasi langsung di root template_result/
      const results = await downloadVerificationFiles(
        host,
        ['/'],
        paths.ACFOLDER_RESULT_PATH,
        (current, total) => {
          const now = Date.now();
          if (now - lastEdit < 2000 && current !== total) return;
          lastEdit = now;
          ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            `🤖 [${current}/${total}] Processing\n\`https://${host}/\``,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        },
        { skipReadme: true, onLoginRequired, waitReady }
      );

      // Status tracking (non-kritis) — folder domain dibuat oleh /scantargets; skip kalau belum ada
      try {
        updateStatus(host, { addedProperties: results.filter(r => r.success).map(r => r.prefix) });
      } catch {}

      const r = results[0] || { success: false, error: 'No result' };
      let report = `✅ *GSC Verification File Written*\n\n`;
      report += `🌐 Property: \`https://${host}/\`\n`;
      report += `📁 Output: \`${paths.ACFOLDER_RESULT_PATH}\`\n\n`;
      report += `${r.success ? '✅' : '❌'} \`${r.fileName || '?'}\``;
      if (r.error) report += ` _(${r.error})_`;
      report += `\n\n`;
      if (r.success) {
        report += `📦 1 file verifikasi tersimpan di root \`template_result/\`\n\n`;
        report += `👉 Upload \`template_result/\` ke domain, lalu \`/verify ${host}\``;
      } else {
        report += `❌ Gagal ambil file verifikasi. Cek folder \`_debug\` di template_result atau ulangi.`;
      }

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });
    })(ctx).catch(err => {
      ctx.reply(`❌ /prepareinto error: ${err.message}`).catch(() => {});
      console.error('[prepareinto] background error:', err);
    });
  });

  // /prepare <domain> — older flow: download + zip per domain
  bot.command('prepare', async (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/prepare domain.com`', { parse_mode: 'Markdown' });

    const cfg = loadDomainData(domain);
    if (!cfg) return ctx.reply('❌ *Belum Di-scan*\n\n👉 Next: `/scantargets` dulu.', { parse_mode: 'Markdown' });

    return withLock(state.locks, domain, async () => {
      cleanGscFiles(domain);

      const msg = await ctx.reply(
        `🤖 Opening Chrome — processing ${cfg.prefixes.length} property...\n_(first run: login Google manual di browser)_`,
        { parse_mode: 'Markdown' }
      );

      const baseDir = path.join(domainDir(domain), 'gsc-files');
      let lastEdit = 0;

      const results = await downloadVerificationFiles(
        domain,
        cfg.prefixes,
        baseDir,
        (current, total, prefix) => {
          const now = Date.now();
          if (now - lastEdit < 2000 && current !== total) return;
          lastEdit = now;
          ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            `🤖 [${current}/${total}] Processing\n\`${prefix}\``,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }
      );

      updateStatus(domain, { addedProperties: results.filter(r => r.success).map(r => r.prefix) });

      const masterReadme =
`============================================
GSC VERIFICATION ZIP — ${domain}
============================================

CARA UPLOAD (PALING GAMPANG):

1. Extract zip ini LANGSUNG di ROOT domain lo.
2. File HTML akan auto-masuk ke folder yang sesuai.
3. Pastikan file bisa diakses via:
   https://${domain}/google-XXX.html
4. Setelah ke-upload, balik ke Telegram:
   /verify ${domain}
============================================
`;
      fs.writeFileSync(path.join(baseDir, 'README.txt'), masterReadme);

      const zipPath = path.join(domainDir(domain), 'gsc-files.zip');
      await zipFolder(baseDir, zipPath);

      let report = `✅ *GSC Files Ready*\n\n`;
      results.forEach(r => {
        report += `${r.success ? '✅' : '❌'} \`${r.prefix}\``;
        if (r.fileName) report += ` → \`${r.fileName}\``;
        if (r.error) report += ` _(${r.error})_`;
        report += `\n`;
      });
      const ok = results.filter(r => r.success).length;
      report += `\n📦 ${ok}/${results.length} files berhasil\n\n`;
      report += `👉 Extract zip, upload ke domain sesuai folder, lalu \`/verify ${domain}\``;

      await ctx.replyWithDocument(
        { source: zipPath, filename: `${domain}-gsc.zip` },
        { caption: report, parse_mode: 'Markdown' }
      );
    })(ctx);
  });

  // /verify <domain> — fire-and-forget biar anti 90s timeout
  bot.command('verify', async (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/verify domain.com`', { parse_mode: 'Markdown' });

    const cfg = loadDomainData(domain);
    if (!cfg) return ctx.reply('❌ *Belum Di-scan*\n\n👉 Next: `/scantargets` dulu.', { parse_mode: 'Markdown' });

    await ctx.reply(`🔐 Verifying ${cfg.prefixes.length} property... _(bot run di background, wait result)_`, { parse_mode: 'Markdown' });

    withLock(state.locks, domain, async () => {
      const msg = await ctx.reply(`🔐 Starting...`);
      let lastEdit = 0;

      const results = await verifyProperties(
        domain,
        cfg.prefixes,
        (current, total, prefix) => {
          const now = Date.now();
          if (now - lastEdit < 2000 && current !== total) return;
          lastEdit = now;
          ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            `🔐 [${current}/${total}] \`${prefix}\``,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }
      );

      updateStatus(domain, { verifiedProperties: results.filter(r => r.verified).map(r => r.prefix) });

      let report = `🔐 *Verification Result*\n\n`;
      results.forEach(r => {
        report += `${r.verified ? '✅' : '❌'} \`${r.prefix}\``;
        if (r.skipped) report += ` _(Already verified)_`;
        else if (r.error) report += ` _(${r.error})_`;
        report += `\n`;
      });
      const ok = results.filter(r => r.verified).length;
      report += `\n${ok}/${results.length} verified\n\n👉 Next: \`/index ${domain}\``;

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });
    })(ctx).catch(err => {
      ctx.reply(`❌ /verify error: ${err.message}`).catch(() => {});
      console.error('[verify] background error:', err);
    });
  });

  // /index <domain> — fire-and-forget juga
  bot.command('index', async (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/index domain.com`', { parse_mode: 'Markdown' });

    const cfg = loadDomainData(domain);
    if (!cfg) return ctx.reply('❌ *Belum Di-scan*\n\n👉 Next: `/scantargets` dulu.', { parse_mode: 'Markdown' });

    const totalEst = Object.values(cfg.urlsByPrefix)
      .reduce((acc, urls) => acc + Math.min(urls.length, 10), 0);

    await ctx.reply(
      `🚀 Starting indexing — ${totalEst} URL...\n_(bot run di background, wait progress update)_`,
      { parse_mode: 'Markdown' }
    );

    withLock(state.locks, domain, async () => {
      const msg = await ctx.reply(`🚀 Initializing... [0/${totalEst}]`);

      let lastEdit = 0;
      const indexed = [];

      const results = await requestIndexAll(
        domain,
        cfg.urlsByPrefix,
        (current, total, url, success, reason) => {
          if (success) indexed.push(url);
          const now = Date.now();
          if (now - lastEdit < 3000 && current !== total) return;
          lastEdit = now;
          const icon = success ? '✅' : (reason === 'QUOTA' ? '🛑' : '❌');
          ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            `🚀 [${current}/${total}] ${icon}\n\`${url.slice(0, 70)}\``,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }
      );

      // Simpan failed URLs untuk /retryindex
      const failedResults = results.filter(r => !r.success && r.error !== 'Quota exceeded');
      const quotaResults = results.filter(r => r.error === 'Quota exceeded');

      updateStatus(domain, {
        indexedUrls: indexed,
        lastIndexAt: Date.now(),
        failedUrls: failedResults.map(r => ({ url: r.url, error: r.error })),
        quotaUrls: quotaResults.map(r => r.url),
      });

      const ok = results.filter(r => r.success).length;
      const quota = quotaResults.length;
      const failed = failedResults.length;

      let report = `✅ *Indexing Complete*\n\n`;
      report += `📊 Success : ${ok}/${results.length}\n`;
      if (quota > 0) report += `🛑 Quota   : ${quota}\n`;
      if (failed > 0) report += `❌ Failed  : ${failed}\n`;
      report += `🕒 Time : ${new Date().toLocaleString()}\n\n`;

      // Tampilin daftar failed URLs biar gampang manual retry
      if (failed > 0) {
        report += `*❌ Failed URLs (bisa di-retry pakai /retryindex ${domain}):*\n`;
        failedResults.slice(0, 10).forEach((r, i) => {
          report += `${i + 1}. \`${r.url}\`\n   _(${r.error || 'unknown'})_\n`;
        });
        if (failed > 10) report += `_+${failed - 10} lainnya..._\n`;
        report += `\n`;
      }

      // Tampilin quota URLs juga
      if (quota > 0) {
        report += `*🛑 Quota exceeded URLs (wait besok):*\n`;
        quotaResults.slice(0, 5).forEach((r, i) => {
          report += `${i + 1}. \`${r.url}\`\n`;
        });
        if (quota > 5) report += `_+${quota - 5} lainnya..._\n`;
        report += `\n`;
      }

      report += `💡 *Tips:*\n`;
      if (failed > 0) report += `• Re-try failed: \`/retryindex ${domain}\`\n`;
      if (quota > 0) report += `• Quota refresh besok pagi, jalankan ulang \`/index ${domain}\`\n`;

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });

      // Kirim list failed URLs sebagai file kalau banyak (>10)
      if (failed > 10) {
        const failedList = failedResults.map(r => `${r.url}\t${r.error || 'unknown'}`).join('\n');
        const failedFile = `failed-urls-${domain}-${Date.now()}.txt`;
        const filePath = path.join(require('os').tmpdir(), failedFile);
        fs.writeFileSync(filePath, `# Failed URLs untuk ${domain}\n# Tanggal: ${new Date().toLocaleString()}\n\n${failedList}`);
        await ctx.replyWithDocument({ source: filePath, filename: failedFile });
        try { fs.unlinkSync(filePath); } catch {}
      }
    })(ctx).catch(err => {
      ctx.reply(`❌ /index error: ${err.message}`).catch(() => {});
      console.error('[index] background error:', err);
    });
  });

  // /retryindex <domain> — re-try only failed URLs dari last run
  bot.command('retryindex', async (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/retryindex domain.com`', { parse_mode: 'Markdown' });

    const cfg = loadDomainData(domain);
    if (!cfg) return ctx.reply('❌ *Belum Di-scan*\n\n👉 Next: `/scantargets` dulu.', { parse_mode: 'Markdown' });

    const status = loadStatus(domain);
    const failedUrls = status?.failedUrls || [];

    if (failedUrls.length === 0) {
      return ctx.reply(
        `ℹ️ Gak ada failed URLs untuk *${domain}*.\n\n` +
        `Run \`/index ${domain}\` dulu untuk submit indexing.`,
        { parse_mode: 'Markdown' }
      );
    }

    await ctx.reply(
      `🔁 *Retry Index*\n\n` +
      `📊 Failed URLs sebelumnya: ${failedUrls.length}\n` +
      `_(bot run di background, wait progress update)_`,
      { parse_mode: 'Markdown' }
    );

    // Group failed URLs by prefix (cocokin dengan cfg.urlsByPrefix structure)
    const retryByPrefix = {};
    for (const item of failedUrls) {
      // Cari prefix yang URL-nya match
      let matchedPrefix = null;
      for (const p of cfg.prefixes) {
        const urls = cfg.urlsByPrefix[p] || [];
        if (urls.includes(item.url)) {
          matchedPrefix = p;
          break;
        }
      }
      // Fallback: pakai root prefix kalau gak ketemu
      if (!matchedPrefix) matchedPrefix = '/';
      if (!retryByPrefix[matchedPrefix]) retryByPrefix[matchedPrefix] = [];
      retryByPrefix[matchedPrefix].push(item.url);
    }

    withLock(state.locks, domain, async () => {
      const msg = await ctx.reply(`🔁 Retrying ${failedUrls.length} URL...`);
      let lastEdit = 0;
      const indexed = [];

      const results = await requestIndexAll(
        domain,
        retryByPrefix,
        (current, total, url, success, reason) => {
          if (success) indexed.push(url);
          const now = Date.now();
          if (now - lastEdit < 3000 && current !== total) return;
          lastEdit = now;
          const icon = success ? '✅' : (reason === 'QUOTA' ? '🛑' : '❌');
          ctx.telegram.editMessageText(
            ctx.chat.id, msg.message_id, null,
            `🔁 [${current}/${total}] ${icon}\n\`${url.slice(0, 70)}\``,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
        }
      );

      // Update status: replace failedUrls with new failed (yg masih gagal)
      const newFailed = results.filter(r => !r.success && r.error !== 'Quota exceeded')
        .map(r => ({ url: r.url, error: r.error }));
      const newQuota = results.filter(r => r.error === 'Quota exceeded').map(r => r.url);

      updateStatus(domain, {
        indexedUrls: [...(status?.indexedUrls || []), ...indexed],
        lastIndexAt: Date.now(),
        failedUrls: newFailed,
        quotaUrls: newQuota,
      });

      const ok = results.filter(r => r.success).length;
      let report = `🔁 *Retry Complete*\n\n`;
      report += `📊 Success : ${ok}/${results.length}\n`;
      if (newFailed.length > 0) report += `❌ Still Failed : ${newFailed.length}\n`;
      if (newQuota.length > 0) report += `🛑 Quota : ${newQuota.length}\n`;
      report += `🕒 Time : ${new Date().toLocaleString()}\n\n`;

      if (newFailed.length > 0) {
        report += `*Masih gagal:*\n`;
        newFailed.slice(0, 5).forEach((r, i) => {
          report += `${i + 1}. \`${r.url}\` _(${r.error})_\n`;
        });
        if (newFailed.length > 5) report += `_+${newFailed.length - 5} lainnya..._\n`;
        report += `\n💡 Coba \`/retryindex ${domain}\` lagi, atau index manual via GSC.`;
      } else {
        report += `🎉 Semua URL berhasil diindex!`;
      }

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });
    })(ctx).catch(err => {
      ctx.reply(`❌ /retryindex error: ${err.message}`).catch(() => {});
      console.error('[retryindex] background error:', err);
    });
  });

  // /run <domain> — GABUNG verify + index. 1 URL = 1 property.
  // property (folder) di-verify → masuk → index URL aslinya. Loop sampai habis.
  bot.command('run', async (ctx) => {
    const domain = ctx.message.text.split(/\s+/)[1];
    if (!domain) return ctx.reply('ℹ️ *Format*\n\n`/run domain.com`', { parse_mode: 'Markdown' });

    const cfg = loadDomainData(domain);
    if (!cfg) return ctx.reply('❌ *Belum Di-scan*\n\n👉 Next: `/scantargets` dulu.', { parse_mode: 'Markdown' });

    // Flatten semua URL dari scantargets (dedupe, jaga urutan)
    const seen = new Set();
    const allUrls = [];
    for (const p of cfg.prefixes) {
      for (const u of (cfg.urlsByPrefix[p] || [])) {
        if (!seen.has(u)) { seen.add(u); allUrls.push(u); }
      }
    }

    if (allUrls.length === 0) return ctx.reply('❌ Gak ada URL di scantargets buat di-run.');

    await ctx.reply(
      `🤖 *Run verify + index* — ${allUrls.length} URL (1 URL = 1 property)\n` +
      `_(jalan di background. Kalau belum login Google, bot kasih notif kirim /ready)_`,
      { parse_mode: 'Markdown' }
    );

    withLock(state.locks, domain, async () => {
      const msg = await ctx.reply(`🚀 Starting... [0/${allUrls.length}]`);
      let lastEdit = 0;

      const onLoginRequired = async () => {
        await ctx.reply(
          `🔐 *LOGIN GOOGLE DIPERLUKAN*\n\n` +
          `1️⃣ Chrome udah kebuka di layar lu\n` +
          `2️⃣ Login Google manual (akun yang punya akses GSC)\n` +
          `3️⃣ Setelah dashboard GSC kebuka, kirim \`/ready\` di Telegram\n\n` +
          `⏱️ Bot bakal tunggu max 10 menit.\n` +
          `❌ Ketik \`/cancellogin\` kalau mau batalkan.`,
          { parse_mode: 'Markdown' }
        );
      };

      const waitReady = () => new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
          state.loginReadyState.delete(ctx.from.id);
          reject(new Error('Login timeout 10 menit. /run dibatalkan.'));
        }, 10 * 60 * 1000);
        state.loginReadyState.set(ctx.from.id, { resolve, reject, timeoutHandle });
      });

      const out = await verifyAndIndexAll(
        domain,
        allUrls,
        (info) => {
          const now = Date.now();
          if (info.phase !== 'root' && now - lastEdit < 2500 && info.current !== info.total) return;
          lastEdit = now;
          let line;
          if (info.phase === 'root') {
            line = (info.verified === undefined)
              ? `🔐 Verifying domain utama dulu...\n\`${info.property}\``
              : `${info.verified ? '✅' : '⚠️'} Root ${info.verified ? 'verified' : 'BELUM verified'}\n\`${info.property}\``;
          } else if (info.phase === 'verify') {
            const icon = info.failed ? '❌' : '🔐';
            line = `[${info.current}/${info.total}] ${icon} Verify\n\`${info.property}\``;
          } else {
            const icon = info.indexed ? '✅' : (info.reason === 'QUOTA' ? '🛑' : '❌');
            line = `[${info.current}/${info.total}] ${icon} Index\n\`${info.url.slice(0, 70)}\``;
          }
          ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, line, { parse_mode: 'Markdown' }).catch(() => {});
        },
        { onLoginRequired, waitReady }
      );

      const results = out.results;
      const root = out.root || { verified: false, status: 'UNKNOWN' };

      // Simpan status
      try {
        updateStatus(domain, {
          verifiedProperties: [...new Set(results.filter(r => r.verified).map(r => r.property))],
          indexedUrls: results.filter(r => r.indexed).map(r => r.url),
          lastRunAt: Date.now(),
          failedUrls: results.filter(r => !r.indexed && r.reason !== 'QUOTA').map(r => ({ url: r.url, error: r.error })),
          quotaUrls: results.filter(r => r.reason === 'QUOTA').map(r => r.url),
        });
      } catch {}

      const verifiedOk = results.filter(r => r.verified).length;
      const indexedOk = results.filter(r => r.indexed).length;
      const quota = results.filter(r => r.reason === 'QUOTA').length;
      const failed = results.filter(r => !r.indexed && r.reason !== 'QUOTA').length;

      let report = `✅ *Run Complete*\n\n`;
      report += `🌐 Root     : ${root.verified ? '✅ verified' : '⚠️ ' + (root.status || 'belum verified')}\n`;
      report += `🔐 Verified : ${verifiedOk}/${results.length} property\n`;
      report += `🚀 Indexed  : ${indexedOk}/${results.length} URL\n`;
      if (quota > 0)  report += `🛑 Quota    : ${quota}\n`;
      if (failed > 0) report += `❌ Failed   : ${failed}\n`;
      report += `🕒 ${new Date().toLocaleString()}\n\n`;

      const fails = results.filter(r => !r.indexed && r.reason !== 'QUOTA');
      if (fails.length > 0) {
        report += `*❌ Gagal index:*\n`;
        fails.slice(0, 8).forEach((r, i) => {
          report += `${i + 1}. \`${r.url}\`\n   _(${r.error || r.reason || 'unknown'})_\n`;
        });
        if (fails.length > 8) report += `_+${fails.length - 8} lainnya..._\n`;
        report += `\n`;
      }
      if (quota > 0) {
        report += `🛑 ${quota} URL kena quota — coba lagi besok pakai \`/run ${domain}\`.\n`;
      }
      if (!root.verified) {
        report += `\n⚠️ *Root domain belum kebukti verified* — biasanya bikin semua property gagal.\n` +
                  `Pastikan file dari \`/prepareinto\` sudah ke-upload & bisa diakses di \`https://${domain}/google-xxx.html\`, lalu ulangi \`/run ${domain}\`.\n`;
      }

      await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });
    })(ctx).catch(err => {
      ctx.reply(`❌ /run error: ${err.message}`).catch(() => {});
      console.error('[run] background error:', err);
    });
  });
};

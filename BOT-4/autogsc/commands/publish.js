const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { zipFolder } = require('../lib/zipper');
const { publishAll } = require('../lib/uploader');
const paths = require('../config/paths');

function validateCfName(name) {
  if (!name) return 'Nama project wajib diisi';
  if (name.length > 58) return 'Nama max 58 chars';
  if (!/^[a-z0-9-]+$/.test(name)) return 'Cuma boleh lowercase, angka, dan hyphen (-)';
  if (name.startsWith('-') || name.endsWith('-')) return 'Tidak boleh diawali/diakhiri hyphen';
  return null;
}

/**
 * /zip — zip template_result + amp_result, kirim ke chat
 * /publishfiles — upload TXT + ZIP ke kodokzuma, kirim list URL
 * /cfpages <name> — deploy amp_result/amp ke Cloudflare Pages
 */
module.exports = function registerPublish(bot) {

  // /zip — zip template_result (exclude _debug + _temp) + amp_result/amp
  bot.command('zip', async (ctx) => {
    const msg = await ctx.reply('🗜️ *Zipping folders...*', { parse_mode: 'Markdown' });

    const outputDir = paths.ZIPS_DIR;
    fs.mkdirSync(outputDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reports = [];
    const successZips = [];

    // ZIP 1: template_result (exclude _debug + _temp)
    try {
      if (!fs.existsSync(paths.ACFOLDER_RESULT_PATH)) {
        reports.push(`❌ template_result : folder gak ada`);
      } else {
        const zipPath1 = path.join(outputDir, `template_result_${ts}.zip`);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `🗜️ *Zipping template_result...*`, { parse_mode: 'Markdown' });
        const r1 = await zipFolder(paths.ACFOLDER_RESULT_PATH, zipPath1, {
          exclude: ['_debug', '_temp', '_zips'],
        });
        reports.push(`✅ template_result : ${r1.files} files (${(r1.size / 1024).toFixed(1)} KB)`);
        successZips.push(zipPath1);
      }
    } catch (e) {
      reports.push(`❌ template_result : ${e.message}`);
    }

    // ZIP 2: amp_result/amp
    try {
      if (!fs.existsSync(paths.ACFOLDER_AMP_RESULT_PATH)) {
        reports.push(`❌ amp_result/amp : folder gak ada (${paths.ACFOLDER_AMP_RESULT_PATH})`);
      } else {
        const zipPath2 = path.join(outputDir, `amp_result_${ts}.zip`);
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, `🗜️ *Zipping amp_result/amp...*`, { parse_mode: 'Markdown' });
        const r2 = await zipFolder(paths.ACFOLDER_AMP_RESULT_PATH, zipPath2);
        reports.push(`✅ amp_result/amp : ${r2.files} files (${(r2.size / 1024).toFixed(1)} KB)`);
        successZips.push(zipPath2);
      }
    } catch (e) {
      reports.push(`❌ amp_result/amp : ${e.message}`);
    }

    let report = `✅ *Zip Result*\n\n${reports.map(r => `• ${r}`).join('\n')}\n\n`;
    if (successZips.length > 0) {
      report += `📤 Sending ${successZips.length} zip file(s)...`;
    }
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown' });

    // Kirim zip ke Telegram (max 50 MB)
    for (const zipPath of successZips) {
      try {
        const stat = fs.statSync(zipPath);
        if (stat.size > 49 * 1024 * 1024) {
          await ctx.reply(`⚠️ *File Terlalu Besar*\n\n• \`${path.basename(zipPath)}\` > 50 MB, gak bisa kirim Telegram.\n• Path : \`${zipPath}\``, { parse_mode: 'Markdown' });
          continue;
        }
        await ctx.replyWithDocument({
          source: zipPath,
          filename: path.basename(zipPath),
        });
      } catch (e) {
        await ctx.reply(`❌ *Gagal Kirim*\n\n• \`${path.basename(zipPath)}\`\n• \`${e.message}\``, { parse_mode: 'Markdown' });
      }
    }
  });

  // /publishfiles — upload semua file ke kodokzuma
  bot.command('publishfiles', async (ctx) => {
    const acRoot = path.resolve(__dirname, '..', '..');
    const zipsDir = paths.ZIPS_DIR;

    const txtFiles = [
      { name: 'template.php',         path: path.join(acRoot, 'template.php') },
      { name: 'template_amp.php',     path: path.join(acRoot, 'template_amp.php') },
      { name: 'robots.txt',           path: path.join(acRoot, 'robots.txt') },
      { name: 'ping.php',             path: path.join(acRoot, 'ping.php') },
      { name: 'sitemap.xml',          path: path.join(acRoot, 'sitemapgenerator/sitemap.xml') },
    ];

    // Cari latest zip files
    let zipFiles = [];
    if (fs.existsSync(zipsDir)) {
      const allZips = fs.readdirSync(zipsDir)
        .filter(f => f.endsWith('.zip'))
        .map(f => ({ name: f, path: path.join(zipsDir, f), mtime: fs.statSync(path.join(zipsDir, f)).mtimeMs }));
      const latestTemplate = allZips.filter(z => z.name.startsWith('template_result_')).sort((a, b) => b.mtime - a.mtime)[0];
      const latestAmp = allZips.filter(z => z.name.startsWith('amp_result_')).sort((a, b) => b.mtime - a.mtime)[0];
      if (latestTemplate) zipFiles.push({ name: 'template_result.zip', path: latestTemplate.path });
      if (latestAmp) zipFiles.push({ name: 'amp_result.zip', path: latestAmp.path });
    }

    if (zipFiles.length === 0) {
      return ctx.reply('⚠️ *Belum Ada ZIP*\n\nBelum ada zip di `result/_zips/`.', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '📦 ZIP Sekarang', callback_data: 'run:zip'     },
          { text: '🏠 Menu Utama',   callback_data: 'menu:main'   },
        ]]}
      });
    }

    await ctx.reply(
      `📤 *Publish Files Started*\n\n` +
      `• TXT : ${txtFiles.length} files\n` +
      `• ZIP : ${zipFiles.length} files\n\n` +
      `_Chrome bakal kebuka, auto login..._`,
      { parse_mode: 'Markdown' }
    );

    const msg = await ctx.reply('🚀 *Starting upload...*', { parse_mode: 'Markdown' });
    let lastEdit = 0;

    publishAll({
      baseUrl: paths.PUBLISH_BASE_URL,
      username: paths.PUBLISH_USERNAME,
      password: paths.PUBLISH_PASSWORD,
      txtFiles,
      zipFiles,
      onProgress: ({ kind, current, total, name }) => {
        const now = Date.now();
        if (now - lastEdit < 2000 && current !== total) return;
        lastEdit = now;
        const emoji = kind === 'txt' ? '📝' : '📦';
        ctx.telegram.editMessageText(
          ctx.chat.id, msg.message_id, null,
          `${emoji} [${current}/${total}] Uploading ${kind.toUpperCase()}\n\`${name}\``,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      },
    }).then(results => {
      let report = `✅ *Publish Result*\n\n`;
      const ok = results.filter(r => r.success).length;
      report += `• Total : ${ok}/${results.length} success\n\n`;

      const txtResults = results.filter(r => r.type === 'txt');
      const zipResults = results.filter(r => r.type === 'zip');

      if (txtResults.length) {
        report += `📝 *TXT Files:*\n`;
        txtResults.forEach(r => {
          report += `${r.success ? '✅' : '❌'} \`${r.name}\`\n`;
          if (r.url) report += `   → \`${r.url}\`\n`;
          if (r.error) report += `   _(${r.error})_\n`;
        });
        report += `\n`;
      }
      if (zipResults.length) {
        report += `📦 *ZIP Files:*\n`;
        zipResults.forEach(r => {
          report += `${r.success ? '✅' : '❌'} \`${r.name}\`\n`;
          if (r.url) report += `   → \`${r.url}\`\n`;
          if (r.error) report += `   _(${r.error})_\n`;
        });
      }

      ctx.telegram.editMessageText(
        ctx.chat.id, msg.message_id, null, report,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      ).catch(() => {});

      // Kirim raw URL list buat copy
      const urlsOnly = results.filter(r => r.success && r.url).map(r => `${r.name}: ${r.url}`).join('\n');
      if (urlsOnly) {
        ctx.reply(
          `📋 *Raw URLs (copy-friendly):*\n\`\`\`\n${urlsOnly}\n\`\`\``,
          { parse_mode: 'Markdown', disable_web_page_preview: true }
        );
      }
    }).catch(err => {
      ctx.reply(`❌ *Publish Error*\n\n• \`${err.message}\``, { parse_mode: 'Markdown' }).catch(() => {});
      console.error('[publishfiles] error:', err);
    });
  });

  // /cfpages <name> — deploy ke Cloudflare Pages (pakai API Token, non-interactive)
  bot.command('cfpages', async (ctx) => {
    const args = ctx.message.text.split(/\s+/).slice(1);
    const projectName = args[0];

    const invalid = validateCfName(projectName);
    if (invalid) {
      return ctx.reply(
        `❌ *Nama Project Invalid*\n\n` +
        `• ${invalid}\n\n` +
        `*Format:* \`/cfpages <project-name>\`\n` +
        `*Contoh:* \`/cfpages mahaslot-amp\`\n\n` +
        `*Naming rules:*\n` +
        `• ✅ Lowercase: \`a-z\`\n` +
        `• ✅ Angka: \`0-9\`\n` +
        `• ✅ Hyphen: \`-\`\n` +
        `• ❌ NO underscore, dot, spasi`,
        { parse_mode: 'Markdown' }
      );
    }

    // Cek env auth — support 2 mode: API Token (modern) atau Global API Key (legacy)
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;
    const cfApiKey = process.env.CLOUDFLARE_API_KEY;
    const cfEmail = process.env.CLOUDFLARE_EMAIL;
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    const hasToken = !!cfToken;
    const hasGlobalKey = !!cfApiKey && !!cfEmail;

    if (!hasToken && !hasGlobalKey) {
      return ctx.reply(
        `❌ *Auth Cloudflare Belum Di-set*\n\n` +
        `Set salah satu di \`.env\`:\n\n` +
        `*OPSI A — API Token (recommended):*\n` +
        `\`CLOUDFLARE_API_TOKEN=xxxxx\`\n` +
        `\`CLOUDFLARE_ACCOUNT_ID=yyyyy\`\n\n` +
        `*OPSI B — Global API Key (legacy):*\n` +
        `\`CLOUDFLARE_EMAIL=email@example.com\`\n` +
        `\`CLOUDFLARE_API_KEY=zzzzz\`\n\n` +
        `💡 Restart bot setelah edit \`.env\``,
        { parse_mode: 'Markdown' }
      );
    }

    if (!fs.existsSync(paths.ACFOLDER_AMP_SOURCE_PATH)) {
      return ctx.reply(`❌ *Folder Tidak Ada*\n\n• \`${paths.ACFOLDER_AMP_SOURCE_PATH}\``, { parse_mode: 'Markdown' });
    }

    const fileCount = fs.readdirSync(paths.ACFOLDER_AMP_SOURCE_PATH).length;

    const authMode = hasToken ? 'API Token' : 'Global API Key';
    await ctx.reply(
      `🚀 *CF Pages Deploy*\n\n` +
      `• Project : \`${projectName}\`\n` +
      `• Source  : \`${paths.ACFOLDER_AMP_SOURCE_PATH}\`\n` +
      `• Items   : ${fileCount}\n` +
      `• Auth    : ${authMode}\n\n` +
      `_Step 1/2: Ensuring project exists..._`,
      { parse_mode: 'Markdown' }
    );

    const msg = await ctx.reply(`⏳ *Setting up project* \`${projectName}\`...`, { parse_mode: 'Markdown' });

    // Build env vars sesuai mode auth
    const wranglerEnv = { ...process.env };
    if (hasToken) {
      wranglerEnv.CLOUDFLARE_API_TOKEN = cfToken;
    } else {
      wranglerEnv.CLOUDFLARE_API_KEY = cfApiKey;
      wranglerEnv.CLOUDFLARE_EMAIL = cfEmail;
      delete wranglerEnv.CLOUDFLARE_API_TOKEN;
    }
    if (cfAccountId) wranglerEnv.CLOUDFLARE_ACCOUNT_ID = cfAccountId;

    // Helper: run wrangler command & capture output
    function runWrangler(args) {
      return new Promise((resolve) => {
        const proc = spawn('wrangler', args, { shell: true, env: wranglerEnv });
        let out = '', err = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.stderr.on('data', d => { err += d.toString(); });
        proc.on('close', code => resolve({ code, stdout: out, stderr: err }));
        proc.on('error', e => resolve({ code: -1, stdout: '', stderr: e.message }));
      });
    }

    const startTime = Date.now();

    // STEP 1: Create project (ignore error kalau udah exist)
    const createResult = await runWrangler([
      'pages', 'project', 'create', projectName,
      '--production-branch', 'main',
    ]);

    // Check if create succeeded OR project already exists (kedua-duanya OK)
    const alreadyExists = (createResult.stderr + createResult.stdout).includes('already exists') ||
                         (createResult.stderr + createResult.stdout).match(/8000007|exists/i);
    const createOk = createResult.code === 0 || alreadyExists;

    if (!createOk) {
      const errSnippet = (createResult.stderr || createResult.stdout).slice(-1500);
      return ctx.telegram.editMessageText(
        ctx.chat.id, msg.message_id, null,
        `❌ Create Project Failed (exit ${createResult.code})\n\n${errSnippet}`
      ).catch(() => {});
    }

    // STEP 2: Deploy
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null,
      `⏳ *Step 2/2: Deploying files...*`, { parse_mode: 'Markdown' }
    ).catch(() => {});

    const deployResult = await runWrangler([
      'pages', 'deploy', paths.ACFOLDER_AMP_SOURCE_PATH,
      '--project-name', projectName,
      '--commit-dirty=true',
      '--branch', 'main',
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const combined = deployResult.stdout + '\n' + deployResult.stderr;
    // FIXED regex: support subdomain hash (e.g. https://31ece0c2.nonetwwww.pages.dev)
    const urlMatch = combined.match(/https:\/\/[\w.-]+\.pages\.dev/g);
    const previewUrl = urlMatch ? urlMatch[0] : null;
    const productionUrl = `https://${projectName}.pages.dev`;

    // Sukses kalau exit code 0 (gak perlu wajib ada URL — wrangler kadang gak print URL di stdout)
    const isSuccess = deployResult.code === 0 &&
                      (combined.includes('Deployment complete') ||
                       combined.includes('Success') ||
                       combined.includes('Uploaded') ||
                       previewUrl);

    if (isSuccess) {
      const report =
        `✅ *Deploy Success!*\n\n` +
        `• Project    : \`${projectName}\`\n` +
        `• Production : \`${productionUrl}\`\n` +
        (previewUrl ? `• Preview    : \`${previewUrl}\`\n` : '') +
        `• Files      : ${fileCount}\n` +
        `• Time       : ${elapsed}s\n\n` +
        `💡 Tunggu 30-60 detik untuk DNS propagation.`;
      ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, report, { parse_mode: 'Markdown', disable_web_page_preview: true }).catch(() => {});
    } else {
      const errSnippet = combined.slice(-1500);
      ctx.telegram.editMessageText(
        ctx.chat.id, msg.message_id, null,
        `❌ Deploy Failed (exit code ${deployResult.code})\n\n` +
        `${errSnippet}\n\n` +
        `💡 Cek terminal log buat detail.`
      ).catch(() => {});
      console.error('[cfpages] deploy stderr:', deployResult.stderr);
      console.error('[cfpages] deploy stdout:', deployResult.stdout);
    }
  });
};

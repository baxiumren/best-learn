const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const UPLOADER_PROFILE_DIR = path.resolve(__dirname, '..', 'chrome-profile-uploader');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Generate random title (16-char hex).
 */
function randomTitle(prefix = '') {
  const hex = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${hex}` : hex;
}

async function launchUploaderBrowser() {
  fs.mkdirSync(UPLOADER_PROFILE_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: UPLOADER_PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
    ],
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  return { browser, page };
}

/**
 * Ensure logged in to https://kodokzuma.gaterlaluyakin.xyz/
 * Detect login form → auto-fill credentials → submit.
 */
async function ensureLoggedIn(page, baseUrl, username, password) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // Cek apakah login form muncul
  const loginForm = await page.$('#loginForm');
  if (loginForm) {
    console.log('🔐 Login form detected, auto-fill credentials...');
    await page.type('#username', username, { delay: 30 });
    await page.type('#password', password, { delay: 30 });
    await sleep(300);
    await page.click('#loginBtn');
    // Wait redirect / form gone
    await page.waitForFunction(
      () => !document.querySelector('#loginForm'),
      { timeout: 15000 }
    );
    await sleep(1500);
    console.log('✅ Logged in!');
  }
}

/**
 * Upload satu TXT file (content) → return raw URL.
 */
async function uploadTxt(page, baseUrl, title, content) {
  // Pastikan ke halaman utama
  if (!page.url().startsWith(baseUrl)) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
  }

  // Switch to Create TXT tab
  await page.click('#tabCreate');
  await sleep(800);

  // Clear & fill title
  await page.click('#fileTitle', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#fileTitle', title, { delay: 20 });

  // Clear & fill content (large content via evaluate, faster than type())
  await page.evaluate((c) => {
    const el = document.querySelector('#fileContent');
    el.value = c;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, content);
  await sleep(500);

  // Click Create File
  await page.click('#createBtn');
  await sleep(3000); // wait save

  // Search by title untuk find raw URL
  // Title yang dibuat akan jadi nama file: <title>.txt
  const searchKey = title.endsWith('.txt') ? title : `${title}.txt`;
  await page.click('#searchInput', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#searchInput', searchKey, { delay: 20 });
  await sleep(1500); // wait list update

  // Extract raw URL — cari item yang nama file-nya match, ambil href Raw
  const rawUrl = await page.evaluate((needle) => {
    const items = document.querySelectorAll('.file-item');
    for (const item of items) {
      const nameEl = item.querySelector('.file-name');
      if (!nameEl) continue;
      const name = nameEl.textContent.trim();
      if (name === needle || name.startsWith(needle.replace('.txt', ''))) {
        const rawLink = item.querySelector('a[href*="/raw/"]');
        if (rawLink) return rawLink.href;
      }
    }
    // Fallback: first raw link
    const first = document.querySelector('a[href*="/raw/"]');
    return first ? first.href : null;
  }, searchKey);

  return rawUrl;
}

/**
 * Upload satu ZIP file → return URL.
 */
async function uploadZip(page, baseUrl, zipPath, customFilename) {
  if (!fs.existsSync(zipPath)) throw new Error(`Zip not found: ${zipPath}`);

  if (!page.url().startsWith(baseUrl)) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
  }

  // Switch to Upload ZIP tab
  await page.click('#tabZip');
  await sleep(800);

  // Fill custom filename
  await page.click('#zipFilename', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#zipFilename', customFilename, { delay: 20 });

  // Upload file via file input
  const fileInput = await page.$('#zipFileInput');
  await fileInput.uploadFile(path.resolve(zipPath));
  await sleep(1000);

  // Click Upload ZIP button (tunggu dia enable)
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('#zipUploadBtn');
      return btn && !btn.disabled;
    },
    { timeout: 10000 }
  );
  await page.click('#zipUploadBtn');

  // Wait upload selesai (bisa berat, kasih 60s)
  await sleep(3000);

  // Switch ke ZIP Files list & search
  const searchKey = customFilename.endsWith('.zip') ? customFilename : `${customFilename}.zip`;
  try {
    await page.click('#tabZipFiles');
    await sleep(1000);
  } catch {}

  // Search
  await page.click('#searchInput', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#searchInput', searchKey, { delay: 20 });
  await sleep(2000);

  // Extract URL dari onclick="copyToClipboard('URL')"
  const zipUrl = await page.evaluate((needle) => {
    const items = document.querySelectorAll('.file-item');
    for (const item of items) {
      const nameEl = item.querySelector('.file-name');
      if (!nameEl) continue;
      const name = nameEl.textContent.trim();
      if (name === needle || name.startsWith(needle.replace('.zip', ''))) {
        const copyBtn = item.querySelector('.btn-copy[onclick*="copyToClipboard"]');
        if (copyBtn) {
          const m = copyBtn.getAttribute('onclick').match(/copyToClipboard\(['"]([^'"]+)['"]\)/);
          if (m) return m[1];
        }
      }
    }
    // Fallback: first copy button
    const first = document.querySelector('.btn-copy[onclick*="copyToClipboard"]');
    if (first) {
      const m = first.getAttribute('onclick').match(/copyToClipboard\(['"]([^'"]+)['"]\)/);
      if (m) return m[1];
    }
    return null;
  }, searchKey);

  return zipUrl;
}

/**
 * Main: upload semua TXT files + ZIP files → return array of { name, url, success, error }.
 */
async function publishAll({ baseUrl, username, password, txtFiles, zipFiles, onProgress }) {
  const { browser, page } = await launchUploaderBrowser();
  const results = [];

  try {
    await ensureLoggedIn(page, baseUrl, username, password);

    // === TXT FILES ===
    let i = 0;
    for (const txt of txtFiles) {
      i++;
      onProgress?.({ kind: 'txt', current: i, total: txtFiles.length, name: txt.name });
      try {
        if (!fs.existsSync(txt.path)) {
          results.push({ name: txt.name, type: 'txt', success: false, error: 'File tidak ada' });
          continue;
        }
        const content = fs.readFileSync(txt.path, 'utf-8');
        const title = randomTitle('mt');
        const url = await uploadTxt(page, baseUrl, title, content);
        if (url) {
          results.push({ name: txt.name, type: 'txt', title: `${title}.txt`, url, success: true });
        } else {
          results.push({ name: txt.name, type: 'txt', title: `${title}.txt`, success: false, error: 'URL not found' });
        }
      } catch (e) {
        results.push({ name: txt.name, type: 'txt', success: false, error: e.message.slice(0, 120) });
      }
      await sleep(1500);
    }

    // === ZIP FILES ===
    let j = 0;
    for (const zip of zipFiles) {
      j++;
      onProgress?.({ kind: 'zip', current: j, total: zipFiles.length, name: zip.name });
      try {
        if (!fs.existsSync(zip.path)) {
          results.push({ name: zip.name, type: 'zip', success: false, error: 'File tidak ada' });
          continue;
        }
        const customName = randomTitle('mz').toUpperCase();
        const url = await uploadZip(page, baseUrl, zip.path, customName);
        if (url) {
          results.push({ name: zip.name, type: 'zip', title: `${customName}.zip`, url, success: true });
        } else {
          results.push({ name: zip.name, type: 'zip', title: `${customName}.zip`, success: false, error: 'URL not found' });
        }
      } catch (e) {
        results.push({ name: zip.name, type: 'zip', success: false, error: e.message.slice(0, 120) });
      }
      await sleep(2000);
    }
  } finally {
    try { await browser.close(); } catch {}
  }

  return results;
}

module.exports = { publishAll, randomTitle };

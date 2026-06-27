const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const profileMgr = require('./profile-manager');

puppeteer.use(StealthPlugin());

async function launchBrowser(downloadPath) {
  // Pakai profile aktif dari profile-manager (multi-profile support)
  const PROFILE_DIR = profileMgr.getActivePath();
  console.log(`🔐 Chrome profile: ${profileMgr.getActive()} (${PROFILE_DIR})`);
  if (downloadPath) fs.mkdirSync(downloadPath, { recursive: true });

  const launchOpts = {
    headless: false,
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',          // penting di VPS (shm kecil) biar Chrome gak crash
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
    ],
    defaultViewport: null,
  };
  // Di Linux/VPS: tunjuk ke Chrome sistem (set CHROME_PATH di .env, mis. /usr/bin/google-chrome-stable)
  // Di Windows: biarkan kosong → puppeteer pakai default.
  if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
  const browser = await puppeteer.launch(launchOpts);

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  if (downloadPath) {
    const resolvedPath = path.resolve(downloadPath);
    // Set download behavior di BROWSER level (lebih reliable + persistent across pages)
    try {
      const browserSession = await browser.target().createCDPSession();
      await browserSession.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: resolvedPath,
        eventsEnabled: true,
      });
    } catch (e) {
      console.warn('⚠️  Browser.setDownloadBehavior failed, fallback Page level:', e.message);
    }
    // Backup: set di page level juga
    const client = await page.target().createCDPSession();
    await client.send('Page.enable');
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: resolvedPath,
    });
  }

  return { browser, page };
}

/**
 * Wait sampai file dengan nama tertentu muncul di folder, atau timeout.
 */
async function waitForDownload(folder, expectedFileName, maxWaitMs = 15000) {
  const start = Date.now();
  const fullPath = path.join(folder, expectedFileName);
  while (Date.now() - start < maxWaitMs) {
    if (fs.existsSync(fullPath)) {
      // Make sure file fully written (size stable)
      const size1 = fs.statSync(fullPath).size;
      await sleep(300);
      const size2 = fs.statSync(fullPath).size;
      if (size1 === size2 && size1 > 0) return true;
    }
    await sleep(500);
  }
  return false;
}

/**
 * ensureLoggedIn — kalau belum login Google, kirim notif Telegram + tunggu user kirim /ready
 *
 * options:
 *   - onLoginRequired: async () => void   (callback panggil saat login diperlukan)
 *   - waitReady:       async () => void   (callback nunggu user kirim /ready)
 *   - maxWaitMs:       default 600000 (10 menit)
 */
async function ensureLoggedIn(page, options = {}) {
  const { onLoginRequired, waitReady, maxWaitMs = 10 * 60 * 1000 } = options;

  await page.goto('https://search.google.com/search-console/welcome', { waitUntil: 'networkidle2' });
  await sleep(3000);

  if (!page.url().includes('accounts.google.com') && !page.url().includes('signin')) {
    // Udah login
    return { wasLoggedIn: true };
  }

  console.log('⚠️  Belum login Google. Tunggu user login manual...');
  if (onLoginRequired) await onLoginRequired();

  // Strategi: kalau ada waitReady → tunggu user kirim /ready
  //           kalau gak ada → polling URL sampai berubah
  const startTime = Date.now();

  if (waitReady) {
    // Mode interaktif: tunggu user explicit kirim /ready
    await waitReady();
    console.log('✅ User confirmed ready.');
  } else {
    // Mode fallback: polling URL
    while (page.url().includes('accounts.google.com') || page.url().includes('signin')) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Login timeout setelah ${maxWaitMs / 1000}s. Coba ulang.`);
      }
      await sleep(2000);
    }
    console.log('✅ Logged in (URL changed)!');
  }

  // Re-navigate ke GSC welcome biar fresh
  await page.goto('https://search.google.com/search-console/welcome', { waitUntil: 'networkidle2' });
  await sleep(2000);
  return { wasLoggedIn: false };
}

/**
 * Convert URL prefix to actual nested folder path (mirror domain structure).
 * "/"                          -> ""              (root of zip)
 * "/service/"                  -> "service"
 * "/service/elektroingenieur/" -> "service/elektroingenieur"
 */
function prefixToFolderName(prefix) {
  if (prefix === '/') return '';
  return prefix.replace(/^\/|\/$/g, '');
}

/**
 * Download verification HTML files for each prefix.
 * Returns array of { prefix, fileName, success, error }.
 */
async function downloadVerificationFiles(domain, prefixes, baseDir, onProgress, options = {}) {
  const { skipReadme = false, onLoginRequired, waitReady } = options;
  fs.mkdirSync(baseDir, { recursive: true });
  const tempDownload = path.resolve(baseDir, '_temp');
  fs.mkdirSync(tempDownload, { recursive: true });

  const { browser, page } = await launchBrowser(tempDownload);
  await ensureLoggedIn(page, { onLoginRequired, waitReady });

  const results = [];

  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i];
    const siteUrl = `https://${domain}${prefix}`;
    onProgress?.(i + 1, prefixes.length, prefix);

    try {
      // === SAFE-CLICK HELPER: scroll + JS fallback ===
      const safeClick = async (element) => {
        try {
          await element.evaluate(el => el.scrollIntoView({ block: 'center' }));
          await sleep(300);
          await element.click({ delay: 50 });
        } catch {
          await page.evaluate(el => {
            let node = el;
            while (node && node !== document.body) {
              if (node.tagName === 'BUTTON' || node.getAttribute?.('role') === 'button' || node.onclick) {
                node.click();
                return;
              }
              node = node.parentElement;
            }
            el.click();
          }, element);
        }
        await sleep(800);
      };

      // === STEP 1: Goto welcome page (force fresh state per iteration) ===
      // Use { waitUntil: 'domcontentloaded' } + manual sleep biar gak hang di networkidle
      // Cache-bypass via timestamp param biar dijamin fresh
      await page.goto(`https://search.google.com/search-console/welcome?_ts=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await sleep(3000);

      // === STEP 2: Cek apakah input URL prefix muncul ===
      // Kalau gak (mungkin dashboard), klik hamburger → Add property
      let urlInput = await page.$('input[aria-label="https://www.example.com"]');
      if (!urlInput) {
        // Mungkin di dashboard → buka menu hamburger
        const hamburger = await page.$('div[aria-label="Main menu"][role="button"]');
        if (hamburger) {
          await safeClick(hamburger);
          await sleep(1500);
          // Klik "Add property" (link/button text "Add property")
          const addPropertyBtns = await page.$x("//div[@role='button' and .//*[contains(text(),'Add property')]] | //span[normalize-space(text())='Add property']");
          if (addPropertyBtns.length) {
            await safeClick(addPropertyBtns[0]);
            await sleep(2500);
          }
        }
        urlInput = await page.waitForSelector('input[aria-label="https://www.example.com"]', { timeout: 15000 });
      }

      // === STEP 3: ACTIVATE URL prefix box dulu (klik input) ===
      // Penting: kalau gak klik input dulu, sisi Domain (kiri) yang ACTIVE
      // dan Continue button URL prefix bakal DISABLED
      await urlInput.click(); // single click = focus the input
      await sleep(400);
      await urlInput.click({ clickCount: 3 }); // triple-click = select all existing
      await page.keyboard.press('Backspace');
      await sleep(200);
      await urlInput.type(siteUrl, { delay: 30 });
      await sleep(800); // tunggu state update

      // === STEP 4: Klik Continue button — HARUS yang ENABLED (URL prefix side) ===
      // Ada 2 Continue button di page (Domain + URL prefix), pilih yang gak disabled
      const continueBtn = await page.evaluateHandle(() => {
        const btns = document.querySelectorAll('div[role="button"][jsname="LoDsGd"]');
        for (const btn of btns) {
          const isDisabled = btn.getAttribute('aria-disabled') === 'true';
          if (!isDisabled) return btn;
        }
        // Fallback: cari via text Continue yang enabled
        const allBtns = document.querySelectorAll('div[role="button"]');
        for (const btn of allBtns) {
          const text = (btn.textContent || '').trim();
          if (text === 'Continue' && btn.getAttribute('aria-disabled') !== 'true') {
            return btn;
          }
        }
        return null;
      });
      const continueBtnEl = continueBtn.asElement ? continueBtn.asElement() : continueBtn;
      if (continueBtnEl) {
        await safeClick(continueBtnEl);
      } else {
        // Last resort: Enter
        await urlInput.focus();
        await page.keyboard.press('Enter');
      }

      // === STEP 5: WAJIB WAIT "Checking verification..." dialog hilang ===
      await sleep(2000);
      try {
        // Wait until "Checking verification..." text disappears (max 60s)
        await page.waitForFunction(
          () => {
            const text = document.body.innerText || '';
            return !text.includes('Checking verification');
          },
          { timeout: 60000, polling: 1000 }
        );
      } catch (e) {
        console.warn(`⚠️  "Checking verification..." masih ada setelah 60s, lanjut aja`);
      }
      await sleep(2000);

      // === STEP 6: Cari download link (HTML file method auto-expanded) ===
      await page.waitForSelector('div[jscontroller="PHNxDb"] div[role="button"]', { timeout: 20000 });
      const downloadBtn = await page.$('div[jscontroller="PHNxDb"] div[role="button"]');
      if (!downloadBtn) {
        results.push({ prefix, fileName: null, success: false, error: 'Download button not found di verify page' });
        continue;
      }

      // === STEP 7: Extract filename dari .LnE7Zc (regex extract, ignore icon char) ===
      const fileName = await page.evaluate(() => {
        const el = document.querySelector('div[jscontroller="PHNxDb"] div.LnE7Zc');
        if (!el) return null;
        const raw = el.textContent.trim();
        // Regex extract: google[hex chars].html (skip leading icon font Unicode)
        const match = raw.match(/google[a-zA-Z0-9]+\.html/i);
        return match ? match[0] : null;
      });

      if (!fileName) {
        results.push({ prefix, fileName: null, success: false, error: 'Filename tidak ke-extract dari .LnE7Zc' });
        continue;
      }

      // === STEP 8: Click download button — MULTI-STRATEGY ===
      // Hapus dulu file lama kalau ada (biar gak conflict)
      const tempFilePath = path.join(tempDownload, fileName);
      try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch {}

      // Strategy 1: safeClick standard
      await safeClick(downloadBtn);
      let downloaded = await waitForDownload(tempDownload, fileName, 6000);

      // Strategy 2: kalau gagal, click LANGSUNG via dispatchEvent + JS
      if (!downloaded) {
        console.log('⚠️  Strategy 1 gagal, coba dispatchEvent...');
        await page.evaluate(() => {
          const btn = document.querySelector('div[jscontroller="PHNxDb"] div[role="button"]');
          if (!btn) return;
          // Trigger MouseEvent (lebih mirip click manual)
          const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
          const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
          const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          btn.dispatchEvent(mouseDown);
          btn.dispatchEvent(mouseUp);
          btn.dispatchEvent(click);
        });
        downloaded = await waitForDownload(tempDownload, fileName, 6000);
      }

      // Strategy 3: kalau masih gagal, cari <a download> yang mungkin hidden + click
      if (!downloaded) {
        console.log('⚠️  Strategy 2 gagal, coba cari <a download>...');
        await page.evaluate((fname) => {
          const links = document.querySelectorAll('a[href*="google-site-verification"], a[download]');
          for (const a of links) {
            if (a.href && (a.download === fname || a.href.includes(fname))) {
              a.click();
              return;
            }
          }
        }, fileName);
        downloaded = await waitForDownload(tempDownload, fileName, 6000);
      }

      if (!downloaded) {
        // Capture screenshot buat debug
        try {
          const debugDir = path.resolve(baseDir, '_debug');
          fs.mkdirSync(debugDir, { recursive: true });
          const safeName = prefix.replace(/[\/\\]/g, '_').replace(/^_+|_+$/g, '') || 'root';
          await page.screenshot({ path: path.join(debugDir, `download-fail-${safeName}-${Date.now()}.png`), fullPage: true });
        } catch {}
        results.push({ prefix, fileName, success: false, error: 'Download tidak terjadi (file gak muncul di temp)' });
        // Tetep coba Done click biar bisa lanjut next prefix
        const doneBtn = await page.$('div[role="button"][jsname="LgbsSe"]');
        if (doneBtn) await safeClick(doneBtn);
        await sleep(2000);
        continue;
      }

      await sleep(1500); // small buffer

      // Pindahkan ke folder per prefix (mirror domain path)
      const folderName = prefixToFolderName(prefix); // bisa "" untuk root
      const targetDir = folderName ? path.join(baseDir, folderName) : baseDir;
      fs.mkdirSync(targetDir, { recursive: true });

      const tempFile = path.join(tempDownload, fileName);
      const targetFile = path.join(targetDir, fileName);

      if (fs.existsSync(tempFile)) {
        fs.renameSync(tempFile, targetFile);

        if (!skipReadme) {
          fs.writeFileSync(
            path.join(targetDir, 'UPLOAD_KE.txt'),
            `============================================
GSC VERIFICATION FILE
============================================

File         : ${fileName}
Upload ke    : ${siteUrl}
Test URL     : ${siteUrl}${fileName}

Pastikan file bisa diakses langsung lewat URL di atas
sebelum klik /verify di bot.
`
          );
        }

        results.push({ prefix, fileName, success: true, targetFile });
      } else {
        results.push({ prefix, fileName, success: false, error: 'Downloaded file not found in temp' });
      }

      // === STEP 9: Klik "Done" button buat tutup dialog verify ===
      // jsname="LgbsSe" = Done button (kita gak klik VERIFY)
      try {
        const doneBtn = await page.$('div[role="button"][jsname="LgbsSe"]');
        if (doneBtn) {
          await safeClick(doneBtn);
        } else {
          // Fallback via text
          const doneBtns = await page.$x("//div[@role='button'][.//span[normalize-space(text())='Done']]");
          if (doneBtns.length) await safeClick(doneBtns[0]);
        }
        await sleep(1500);
      } catch {}

      await sleep(rand(2000, 4000));
    } catch (e) {
      // Capture screenshot on error untuk debugging
      const debugDir = path.resolve(baseDir, '_debug');
      try {
        fs.mkdirSync(debugDir, { recursive: true });
        const safeName = prefix.replace(/[\/\\]/g, '_').replace(/^_+|_+$/g, '') || 'root';
        const screenshotPath = path.join(debugDir, `error-${safeName}-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`📸 Screenshot saved: ${screenshotPath}`);
      } catch {}
      results.push({ prefix, fileName: null, success: false, error: e.message.slice(0, 120) });
    }
  }

  // Cleanup temp (KEEP _debug folder untuk inspect kalau ada error)
  try { fs.rmSync(tempDownload, { recursive: true, force: true }); } catch {}
  await browser.close();
  return results;
}

/**
 * Verify properties pakai flow:
 * 1. Goto welcome page
 * 2. Klik hamburger menu
 * 3. Klik search property input
 * 4. Type URL prefix
 * 5. Klik option yang muncul di dropdown
 * 6. → Auto trigger "Checking verification..."
 * 7. Wait sampai modal "Ownership auto verified" muncul
 * 8. Klik DONE buat tutup
 * 9. Loop ke prefix berikutnya
 */
async function verifyProperties(domain, prefixes, onProgress) {
  const { browser, page } = await launchBrowser();
  await ensureLoggedIn(page);

  const results = [];

  // Safe-click helper
  const safeClick = async (element) => {
    try {
      await element.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await element.click({ delay: 50 });
    } catch {
      await page.evaluate(el => el.click(), element);
    }
    await sleep(800);
  };

  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i];
    const siteUrl = `https://${domain}${prefix}`;
    onProgress?.(i + 1, prefixes.length, prefix);

    try {
      // === STEP 1: Goto welcome page (fresh state per iteration) ===
      await page.goto(`https://search.google.com/search-console/welcome?_ts=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await sleep(2500);

      // === STEP 2: Klik hamburger menu ===
      const hamburger = await page.$('div[aria-label="Main menu"][role="button"]');
      if (!hamburger) {
        results.push({ prefix, verified: false, error: 'Hamburger menu not found' });
        continue;
      }
      await safeClick(hamburger);
      await sleep(1500);

      // === STEP 3: Klik Search property input ===
      const searchInput = await page.$('input[aria-label="Search property"]');
      if (!searchInput) {
        results.push({ prefix, verified: false, error: 'Search property input not found' });
        continue;
      }
      await searchInput.click();
      await sleep(500);

      // === STEP 4: Type URL ===
      await page.keyboard.type(siteUrl, { delay: 30 });
      await sleep(1500); // tunggu dropdown filter

      // === STEP 5: Cek status verified vs not-verified DULU ===
      // Logic: di dropdown GSC, ada section "NOT VERIFIED"
      //   - Option DI ATAS section "NOT VERIFIED" = udah verified ✅
      //   - Option DI BAWAH section "NOT VERIFIED" = belum verified ❌
      const optionStatus = await page.evaluate((needle) => {
        // Cari header "NOT VERIFIED" (case insensitive)
        const allEls = Array.from(document.querySelectorAll('*'));
        let notVerifiedHeader = null;
        for (const el of allEls) {
          const t = (el.textContent || '').trim().toUpperCase();
          // Match exact "NOT VERIFIED" text node (avoid parent containers)
          if ((t === 'NOT VERIFIED' || t === 'BELUM DIVERIFIKASI') && el.children.length === 0) {
            notVerifiedHeader = el;
            break;
          }
        }

        // Cari option matching URL
        const opts = document.querySelectorAll('div[role="option"]');
        let targetOption = null;
        for (const opt of opts) {
          const rid = opt.getAttribute('data-resourceid') || opt.getAttribute('aria-label') || '';
          if (rid === needle || rid.startsWith(needle)) {
            targetOption = opt;
            break;
          }
        }

        if (!targetOption) {
          return { found: false };
        }

        // Compare DOM position
        // Kalau header NOT VERIFIED gak ada → semua option = verified
        if (!notVerifiedHeader) {
          return { found: true, alreadyVerified: true, element: 'no-header' };
        }

        // Bandingkan posisi dokumen: kalau target BEFORE header = verified, AFTER = not verified
        const position = targetOption.compareDocumentPosition(notVerifiedHeader);
        // DOCUMENT_POSITION_FOLLOWING = 4 → header is AFTER target → target is verified
        // DOCUMENT_POSITION_PRECEDING = 2 → header is BEFORE target → target is not verified
        const isAfterHeader = !!(position & Node.DOCUMENT_POSITION_PRECEDING);
        return { found: true, alreadyVerified: !isAfterHeader };
      }, siteUrl);

      if (!optionStatus.found) {
        results.push({ prefix, verified: false, error: 'Property tidak ada di list (belum di-add ke GSC)' });
        await sleep(2000);
        continue;
      }

      // === SHORTCUT: kalau udah verified, skip click & continue ===
      if (optionStatus.alreadyVerified) {
        results.push({
          prefix,
          verified: true,
          message: 'Already verified (skipped)',
          skipped: true,
        });
        // Klik luar buat tutup dropdown
        await page.keyboard.press('Escape');
        await sleep(500);
        continue;
      }

      // === STEP 5b: Click option (kalau belum verified) ===
      await page.evaluate((needle) => {
        const opts = document.querySelectorAll('div[role="option"]');
        for (const opt of opts) {
          const rid = opt.getAttribute('data-resourceid') || opt.getAttribute('aria-label') || '';
          if (rid === needle || rid.startsWith(needle)) {
            opt.click();
            return;
          }
        }
      }, siteUrl);
      await sleep(2500);

      // === STEP 6: Wait "Checking verification..." selesai (max 60s) ===
      try {
        await page.waitForFunction(
          () => {
            const text = document.body.innerText || '';
            return !text.includes('Checking verification');
          },
          { timeout: 60000, polling: 1000 }
        );
      } catch {
        console.warn(`⚠️ "Checking verification" masih ada setelah 60s untuk ${prefix}`);
      }
      await sleep(2000);

      // === STEP 7: Detect result (success vs fail) ===
      // Strategy 1: Cek button "Go to property" → kalau ada = sukses
      // Strategy 2: Cek text "Ownership ... verified" → backup
      // Strategy 3: Cek text "couldn't verify" → fail jelas
      const verifyResult = await page.evaluate(() => {
        const text = document.body.innerText || '';

        // Cek button "Go to property" muncul = success modal
        const buttons = document.querySelectorAll('div[role="button"] span.RveJvd');
        for (const btn of buttons) {
          const t = (btn.textContent || '').trim();
          if (t === 'Go to property' || t === 'GO TO PROPERTY' || t === 'Buka properti') {
            return { verified: true, message: 'Ownership auto verified' };
          }
        }

        // Cek text success
        if (text.includes('Ownership auto verified') ||
            text.includes('Ownership verified') ||
            text.includes('auto verified') ||
            text.includes('Kepemilikan diverifikasi') ||
            text.includes('verified successfully')) {
          return { verified: true, message: 'Ownership verified' };
        }

        // Cek text fail
        if (text.includes("couldn't verify") ||
            text.includes('Verification failed') ||
            text.includes('could not verify') ||
            text.includes('Gagal verifikasi') ||
            text.includes('Tidak dapat verifikasi') ||
            text.includes('Unable to verify')) {
          return { verified: false, message: 'Verification failed' };
        }

        return { verified: false, message: 'Unknown state' };
      });

      results.push({
        prefix,
        verified: verifyResult.verified,
        message: verifyResult.message,
      });

      // === STEP 8: Klik DONE buat tutup modal (jsname="LgbsSe" sama kek prepareinto) ===
      try {
        const doneBtn = await page.$('div[role="button"][jsname="LgbsSe"]');
        if (doneBtn) {
          await safeClick(doneBtn);
        } else {
          // Fallback via text
          const doneBtns = await page.$x("//div[@role='button'][.//span[normalize-space(text())='DONE' or normalize-space(text())='Done' or normalize-space(text())='OK']]");
          if (doneBtns.length) await safeClick(doneBtns[0]);
        }
        await sleep(1500);
      } catch {}

      await sleep(rand(2000, 4000));
    } catch (e) {
      results.push({ prefix, verified: false, error: e.message.slice(0, 120) });
    }
  }

  await browser.close();
  return results;
}

/**
 * Helper: select property via hamburger → search → click option.
 * Re-use flow yang sama dengan /verify.
 */
async function selectPropertyFromHamburger(page, siteUrl, safeClick) {
  // Step 1: Goto welcome page
  await page.goto(`https://search.google.com/search-console/welcome?_ts=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await sleep(2500);

  // Step 2: Klik hamburger
  const hamburger = await page.$('div[aria-label="Main menu"][role="button"]');
  if (!hamburger) throw new Error('Hamburger menu not found');
  await safeClick(hamburger);
  await sleep(1500);

  // Step 3: Klik Search property input
  const searchInput = await page.$('input[aria-label="Search property"]');
  if (!searchInput) throw new Error('Search property input not found');
  await searchInput.click();
  await sleep(500);

  // Step 4: Type URL
  await page.keyboard.type(siteUrl, { delay: 30 });
  await sleep(1500);

  // Step 5: Klik option matching URL
  const clicked = await page.evaluate((needle) => {
    const opts = document.querySelectorAll('div[role="option"]');
    for (const opt of opts) {
      const rid = opt.getAttribute('data-resourceid') || opt.getAttribute('aria-label') || '';
      if (rid === needle || rid.startsWith(needle)) {
        opt.click();
        return true;
      }
    }
    return false;
  }, siteUrl);

  if (!clicked) throw new Error('Property option not in dropdown');
  await sleep(3000);
}

/**
 * Request indexing untuk semua URL per property.
 *
 * Flow per URL:
 * 1-5. Select property via hamburger (helper)
 * 6.   Wait property loaded
 * 7.   Click URL Inspection sidebar (a[jsname="YhhZY"])
 * 8.   Type URL di top search bar (input[jsname="dSO9oc"]) → Enter
 * 9.   Wait "Test live URL" button appears (= loading done)
 * 10.  Click "Request indexing" button (aria-label contains "Request indexing")
 * 11.  Wait "Testing if live URL can be indexed" loader
 *      Then wait "Indexing requested" success popup
 * 12.  Dismiss popup → next URL
 */
async function requestIndexAll(domain, urlsByPrefix, onProgress, maxPerProperty = 10) {
  const { browser, page } = await launchBrowser();
  await ensureLoggedIn(page);

  // Safe-click helper
  const safeClick = async (element) => {
    try {
      await element.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await element.click({ delay: 50 });
    } catch {
      await page.evaluate(el => el.click(), element);
    }
    await sleep(600);
  };

  const total = Object.values(urlsByPrefix).reduce(
    (acc, urls) => acc + Math.min(urls.length, maxPerProperty),
    0
  );
  let current = 0;
  const results = [];

  for (const [prefix, urls] of Object.entries(urlsByPrefix)) {
    const siteUrl = `https://${domain}${prefix}`;

    // === STEP 1-5: Select property (hamburger flow) ===
    try {
      await selectPropertyFromHamburger(page, siteUrl, safeClick);
    } catch (e) {
      // Mark all URLs di prefix ini sebagai failed
      for (const url of urls.slice(0, maxPerProperty)) {
        current++;
        onProgress?.(current, total, url, false, 'SELECT_PROPERTY_FAIL');
        results.push({ url, success: false, error: `Select property: ${e.message}` });
      }
      continue;
    }

    // === STEP 7: Klik URL Inspection sidebar ===
    try {
      await page.waitForSelector('a[jsname="YhhZY"]', { timeout: 15000 });
      const sidebarBtn = await page.$('a[jsname="YhhZY"]');
      await safeClick(sidebarBtn);
      await sleep(2000);
    } catch (e) {
      // Fallback: cari via text
      try {
        const elems = await page.$x("//a[@role='button'][.//span[contains(text(),'URL inspection') or contains(text(),'Pemeriksaan URL')]]");
        if (elems.length) {
          await safeClick(elems[0]);
          await sleep(2000);
        } else {
          throw new Error('URL Inspection sidebar not found');
        }
      } catch (err) {
        for (const url of urls.slice(0, maxPerProperty)) {
          current++;
          onProgress?.(current, total, url, false, 'SIDEBAR_FAIL');
          results.push({ url, success: false, error: 'URL Inspection sidebar not found' });
        }
        continue;
      }
    }

    const urlsToProcess = urls.slice(0, maxPerProperty);
    let quotaHit = false;

    for (const url of urlsToProcess) {
      current++;
      try {
        // === STEP 8: Type URL di top search bar ===
        const topInput = await page.waitForSelector(
          'input[jsname="dSO9oc"], input[aria-label*="Inspect any URL"]',
          { timeout: 15000 }
        );
        await topInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await sleep(300);
        await topInput.type(url, { delay: 30 });
        await sleep(500);
        await page.keyboard.press('Enter');

        // === STEP 9: Wait sampai "Test live URL" button muncul (= inspection done) ===
        await page.waitForFunction(
          () => {
            const btns = document.querySelectorAll('div[role="button"] span.RveJvd');
            for (const b of btns) {
              const t = (b.textContent || '').trim();
              if (t === 'Test live URL' || t === 'Uji URL versi langsung') return true;
            }
            return false;
          },
          { timeout: 60000, polling: 1500 }
        );
        await sleep(1500);

        // === STEP 10: Cek dulu apakah udah ada "Indexing requested" (URL sudah pernah submit) ===
        const alreadyIndexed = await page.evaluate(() => {
          const text = document.body.innerText || '';
          // Cek text "Indexing requested" yang VISIBLE (bukan di popup loading)
          // Match span.xxvyLd yang ada di card status
          const statusSpans = document.querySelectorAll('span.xxvyLd');
          for (const s of statusSpans) {
            if ((s.textContent || '').includes('Indexing requested')) return true;
          }
          return false;
        });

        // === STEP 10b: Klik "Request indexing" button ===
        // aria-label="Request indexingRequest again" — match itu atau text "Request indexing"
        const requestBtn = await page.evaluateHandle(() => {
          // Strategy 1: aria-label match
          const aria = document.querySelector('div[role="button"][aria-label*="Request indexing"]');
          if (aria) return aria;
          // Strategy 2: span text
          const btns = document.querySelectorAll('div[role="button"]');
          for (const b of btns) {
            const spans = b.querySelectorAll('span');
            for (const s of spans) {
              const t = (s.textContent || '').trim();
              if (t === 'Request indexing' || t === 'Minta pengindeksan') return b;
            }
          }
          return null;
        });

        const requestBtnEl = requestBtn.asElement ? requestBtn.asElement() : requestBtn;
        if (!requestBtnEl) {
          onProgress?.(current, total, url, false, 'BUTTON_NOT_FOUND');
          results.push({ url, success: false, error: 'Request indexing button not found' });
          await sleep(rand(3000, 5000));
          continue;
        }

        await safeClick(requestBtnEl);

        // === STEP 11: Wait popup loading "Testing if live URL can be indexed" ===
        // Tunggu loader appear (max 5s — kadang langsung result kalau quota habis)
        await sleep(1500);

        // Wait sampai "Indexing requested" success muncul ATAU error muncul
        let indexResult = 'TIMEOUT';
        try {
          await page.waitForFunction(
            () => {
              const text = document.body.innerText || '';
              if (text.includes('Indexing requested') && !text.includes('Testing if live URL')) return true;
              if (text.includes('Quota exceeded') || text.includes('Indexing exceeded') ||
                  text.includes('try again later') || text.includes('Coba lagi nanti')) return true;
              return false;
            },
            { timeout: 90000, polling: 2000 }
          );

          // Detect quota vs success
          const finalState = await page.evaluate(() => {
            const text = document.body.innerText || '';
            if (text.includes('Quota exceeded') || text.includes('Indexing exceeded') ||
                text.includes('try again later') || text.includes('Coba lagi nanti')) {
              return 'QUOTA';
            }
            if (text.includes('Indexing requested')) return 'SUCCESS';
            return 'UNKNOWN';
          });
          indexResult = finalState;
        } catch {
          indexResult = 'TIMEOUT';
        }

        // === STEP 12: Dismiss popup (Escape key cukup buat tutup) ===
        await page.keyboard.press('Escape');
        await sleep(800);

        if (indexResult === 'SUCCESS') {
          onProgress?.(current, total, url, true);
          results.push({ url, success: true });
        } else if (indexResult === 'QUOTA') {
          onProgress?.(current, total, url, false, 'QUOTA');
          results.push({ url, success: false, error: 'Quota exceeded' });
          quotaHit = true;
          break;
        } else {
          onProgress?.(current, total, url, false, indexResult);
          results.push({ url, success: false, error: indexResult });
        }

        await sleep(rand(4000, 8000));
      } catch (e) {
        const msg = e.message || '';
        const isQuota = msg.toLowerCase().includes('quota') ||
                        msg.toLowerCase().includes('limit') ||
                        msg.toLowerCase().includes('exceeded');
        onProgress?.(current, total, url, false, isQuota ? 'QUOTA' : 'ERROR');
        results.push({ url, success: false, error: msg.slice(0, 120) });
        if (isQuota) {
          quotaHit = true;
          break;
        }
      }
    }

    if (quotaHit) continue;
  }

  await browser.close();
  return results;
}

/**
 * Derive property (folder) URL dari full URL.
 * Rule: kalau segmen terakhir path = file (ada titik), buang → sisain folder + trailing slash.
 *   https://domain.com/a/index.html  -> https://domain.com/a/
 *   https://domain.com/a/page.html   -> https://domain.com/a/
 *   https://domain.com/a/            -> https://domain.com/a/
 *   https://domain.com/a/b/index.html-> https://domain.com/a/b/
 */
function deriveProperty(fullUrl) {
  const u = new URL(fullUrl);
  const segments = u.pathname.split('/'); // ['', 'a', 'index.html']
  const last = segments[segments.length - 1];
  if (last && last.includes('.')) {
    segments.pop(); // buang nama file
  }
  let dir = segments.join('/');
  if (!dir.endsWith('/')) dir += '/';
  if (dir === '') dir = '/';
  return `${u.protocol}//${u.host}${dir}`;
}

/**
 * Normalisasi URL yang AKAN di-index:
 *   - kalau segmen terakhir = file (ada titik, mis. index.html) → biarkan apa adanya
 *   - kalau BUKAN file & belum ada '/' di akhir → tambahkan '/'
 *   https://x.com/a/index.html  -> https://x.com/a/index.html
 *   https://x.com/a/hroshyma    -> https://x.com/a/hroshyma/
 *   https://x.com/a/            -> https://x.com/a/
 */
function normalizeIndexUrl(fullUrl) {
  const u = new URL(fullUrl);
  const segments = u.pathname.split('/');
  const last = segments[segments.length - 1];
  let pathname = u.pathname;
  if (!(last && last.includes('.')) && !pathname.endsWith('/')) {
    pathname += '/';
  }
  return `${u.protocol}//${u.host}${pathname}${u.search || ''}${u.hash || ''}`;
}

/**
 * Pastikan domain UTAMA (root) verified — pakai file HTML yang sudah di-upload (dari /prepareinto).
 * Wajib sukses biar subfolder (/a/, /b/, ...) bisa AUTO-verified.
 * Returns { verified, status }.
 */
async function ensureRootVerified(page, rootUrl, safeClick) {
  await page.goto(`https://search.google.com/search-console/welcome?_ts=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await sleep(3000);

  let urlInput = await page.$('input[aria-label="https://www.example.com"]');
  if (!urlInput) {
    const hamburger = await page.$('div[aria-label="Main menu"][role="button"]');
    if (hamburger) {
      await safeClick(hamburger);
      await sleep(1500);
      const addBtns = await page.$x("//div[@role='button' and .//*[contains(text(),'Add property')]] | //span[normalize-space(text())='Add property']");
      if (addBtns.length) { await safeClick(addBtns[0]); await sleep(2500); }
    }
    urlInput = await page.waitForSelector('input[aria-label="https://www.example.com"]', { timeout: 15000 }).catch(() => null);
  }
  if (!urlInput) return { verified: false, status: 'NO_INPUT' };

  await urlInput.click();
  await sleep(400);
  await urlInput.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await sleep(200);
  await urlInput.type(rootUrl, { delay: 30 });
  await sleep(800);

  // Continue (sisi URL prefix yang ENABLED)
  const continueBtn = await page.evaluateHandle(() => {
    const btns = document.querySelectorAll('div[role="button"][jsname="LoDsGd"]');
    for (const b of btns) if (b.getAttribute('aria-disabled') !== 'true') return b;
    const all = document.querySelectorAll('div[role="button"]');
    for (const b of all) {
      const t = (b.textContent || '').trim();
      if (t === 'Continue' && b.getAttribute('aria-disabled') !== 'true') return b;
    }
    return null;
  });
  const cEl = continueBtn.asElement ? continueBtn.asElement() : continueBtn;
  if (cEl) await safeClick(cEl);
  else { await urlInput.focus(); await page.keyboard.press('Enter'); }

  await sleep(2000);
  try {
    await page.waitForFunction(() => !((document.body.innerText || '').includes('Checking verification')), { timeout: 60000, polling: 1000 });
  } catch {}
  await sleep(1500);

  // Kalau muncul halaman metode verifikasi (file HTML) → klik tombol "Verify"
  const verifyBtn = await page.evaluateHandle(() => {
    const spans = document.querySelectorAll('div[role="button"] span.RveJvd');
    for (const s of spans) {
      const t = (s.textContent || '').trim();
      if (t === 'Verify' || t === 'VERIFY' || t === 'Verifikasi') return s.closest('div[role="button"]');
    }
    return null;
  });
  const vEl = verifyBtn.asElement ? verifyBtn.asElement() : verifyBtn;
  if (vEl) {
    await safeClick(vEl);
    await sleep(2000);
    try {
      await page.waitForFunction(() => !((document.body.innerText || '').includes('Checking verification')), { timeout: 60000, polling: 1000 });
    } catch {}
    await sleep(1500);
  }

  // Deteksi sukses: ada "Go to property" / teks "verified"
  const ok = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const spans = document.querySelectorAll('div[role="button"] span.RveJvd');
    for (const s of spans) {
      const t = (s.textContent || '').trim();
      if (t === 'Go to property' || t === 'GO TO PROPERTY' || t === 'Buka properti') return true;
    }
    return text.includes('Ownership auto verified') ||
           text.includes('Ownership verified') ||
           text.includes('auto verified') ||
           text.includes('verified successfully') ||
           text.includes('Kepemilikan diverifikasi');
  });

  return { verified: ok, status: ok ? 'VERIFIED' : 'UNKNOWN' };
}

/**
 * Gabungan VERIFY + INDEX, 1 URL = 1 property.
 * Untuk tiap full URL:
 *   - property (folder) = deriveProperty(url) → di-add & verify ke GSC
 *   - setelah masuk property (Go to property / sudah verified) → index URL aslinya
 *
 * onProgress(info) dipanggil dengan:
 *   { phase: 'verify'|'index', current, total, url, property, verified?, indexed?, reason?, failed? }
 *
 * Returns array of { url, property, verified, indexed, error, reason }.
 * Quota TIDAK menghentikan loop — lanjut ke URL berikutnya (sesuai request).
 */
async function verifyAndIndexAll(domain, urls, onProgress, options = {}) {
  const { onLoginRequired, waitReady } = options;
  console.log(`[run] ▶️  verifyAndIndexAll v3 (sidebar-opsional + breadcrumb + tab-switch) | total URL: ${urls.length}`);
  let { browser, page } = await launchBrowser();
  await ensureLoggedIn(page, { onLoginRequired, waitReady });

  const safeClick = async (element) => {
    try {
      await element.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await element.click({ delay: 50 });
    } catch {
      await page.evaluate(el => el.click(), element);
    }
    await sleep(700);
  };

  // ===== STEP 0: verify domain UTAMA (root) sekali — biar subfolder auto-verify =====
  const rootUrl = `https://${domain}/`;
  onProgress?.({ phase: 'root', current: 0, total: urls.length, property: rootUrl });
  let rootStatus;
  try {
    rootStatus = await ensureRootVerified(page, rootUrl, safeClick);
  } catch (e) {
    rootStatus = { verified: false, status: 'ERROR: ' + (e.message || '').slice(0, 80) };
  }
  onProgress?.({ phase: 'root', current: 0, total: urls.length, property: rootUrl, verified: rootStatus.verified });

  // Timeout bisa diatur via .env (default dinaikkan untuk jaringan lambat)
  const INSPECT_TIMEOUT = parseInt(process.env.GSC_INSPECT_TIMEOUT_MS, 10) || 120000; // nunggu hasil inspeksi URL
  const RESULT_TIMEOUT  = parseInt(process.env.GSC_INDEX_RESULT_TIMEOUT_MS, 10) || 120000; // nunggu "Indexing requested"

  const results = [];
  const total = urls.length;

  for (let i = 0; i < urls.length; i++) {
    // Normalisasi: tambah '/' kalau bukan file (tanpa index.html dll)
    let url;
    try { url = normalizeIndexUrl(urls[i]); } catch { url = urls[i]; }
    const current = i + 1;

    let property;
    try {
      property = deriveProperty(url);
    } catch {
      results.push({ url, property: null, verified: false, indexed: false, error: 'Invalid URL', reason: 'INVALID' });
      onProgress?.({ phase: 'verify', current, total, url, property: url, verified: false, failed: true });
      continue;
    }

    onProgress?.({ phase: 'verify', current, total, url, property });

    // ===== PHASE A: add + verify property, lalu masuk ke dalamnya =====
    let entered = false;
    let verified = false;

    try {
      await page.goto(`https://search.google.com/search-console/welcome?_ts=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await sleep(3000);

      let urlInput = await page.$('input[aria-label="https://www.example.com"]');
      if (!urlInput) {
        const hamburger = await page.$('div[aria-label="Main menu"][role="button"]');
        if (hamburger) {
          await safeClick(hamburger);
          await sleep(1500);
          const addBtns = await page.$x("//div[@role='button' and .//*[contains(text(),'Add property')]] | //span[normalize-space(text())='Add property']");
          if (addBtns.length) { await safeClick(addBtns[0]); await sleep(2500); }
        }
        urlInput = await page.waitForSelector('input[aria-label="https://www.example.com"]', { timeout: 15000 }).catch(() => null);
      }

      if (urlInput) {
        await urlInput.click();
        await sleep(400);
        await urlInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await sleep(200);
        await urlInput.type(property, { delay: 30 });
        await sleep(800);

        // Continue button (URL prefix side yang ENABLED)
        const continueBtn = await page.evaluateHandle(() => {
          const btns = document.querySelectorAll('div[role="button"][jsname="LoDsGd"]');
          for (const btn of btns) {
            if (btn.getAttribute('aria-disabled') !== 'true') return btn;
          }
          const allBtns = document.querySelectorAll('div[role="button"]');
          for (const btn of allBtns) {
            const t = (btn.textContent || '').trim();
            if (t === 'Continue' && btn.getAttribute('aria-disabled') !== 'true') return btn;
          }
          return null;
        });
        const continueEl = continueBtn.asElement ? continueBtn.asElement() : continueBtn;
        if (continueEl) await safeClick(continueEl);
        else { await urlInput.focus(); await page.keyboard.press('Enter'); }

        // Wait "Checking verification..." hilang
        await sleep(2000);
        try {
          await page.waitForFunction(
            () => !((document.body.innerText || '').includes('Checking verification')),
            { timeout: 60000, polling: 1000 }
          );
        } catch {}
        await sleep(1500);

        // Cari tombol "Go to property" (by teks span, karena jsname=LgbsSe sama kek Done)
        const goBtn = await page.evaluateHandle(() => {
          const spans = document.querySelectorAll('div[role="button"] span.RveJvd');
          for (const s of spans) {
            const t = (s.textContent || '').trim();
            if (t === 'Go to property' || t === 'GO TO PROPERTY' || t === 'Buka properti') {
              return s.closest('div[role="button"]');
            }
          }
          return null;
        });
        const goEl = goBtn.asElement ? goBtn.asElement() : goBtn;
        if (goEl) {
          const beforeCount = (await browser.pages()).length;
          await safeClick(goEl);
          await sleep(3000);
          // Kalau "Go to property" buka TAB BARU, pindah ke tab terbaru
          const pagesNow = await browser.pages();
          if (pagesNow.length > beforeCount) {
            const newPage = pagesNow[pagesNow.length - 1];
            try { if (page !== newPage) { await page.close().catch(() => {}); } } catch {}
            page = newPage;
            await page.bringToFront().catch(() => {});
            await sleep(1500);
          }
          entered = true;
          verified = true;
        }
      }
    } catch {
      // diem aja, fallback di bawah
    }

    // Fallback: belum masuk (mungkin property SUDAH verified) → masuk via hamburger search
    if (!entered) {
      try {
        await selectPropertyFromHamburger(page, property, safeClick);
        entered = true;
        verified = true; // bisa di-select = sudah ke-add & (auto)verified
      } catch (e) {
        try {
          const debugDir = path.resolve(process.cwd(), '_debug');
          fs.mkdirSync(debugDir, { recursive: true });
          await page.screenshot({ path: path.join(debugDir, `run-verify-fail-${current}-${Date.now()}.png`), fullPage: true });
        } catch {}
        results.push({ url, property, verified: false, indexed: false, error: `Verify/enter gagal: ${e.message.slice(0, 90)}`, reason: 'VERIFY_FAIL' });
        onProgress?.({ phase: 'verify', current, total, url, property, verified: false, failed: true });
        continue;
      }
    }

    // ===== PHASE B: index URL asli (sudah di dalam property) =====
    let indexed = false;
    let indexErr = null;
    let reason = null;

    try {
      console.log(`[run] #${current} → masuk INDEX: ${url}`);

      // Klik URL Inspection sidebar = OPSIONAL (omnibox "Inspeksi URL" selalu ada di atas).
      // Jadi gagal klik sidebar TIDAK menggagalkan index.
      try {
        let sidebar = await page.$('a[jsname="YhhZY"]');
        if (sidebar) {
          await safeClick(sidebar);
          await sleep(1500);
        } else {
          const elems = await page.$x("//a[@role='button'][.//span[contains(text(),'URL inspection') or contains(text(),'Inspeksi URL') or contains(text(),'Pemeriksaan URL')]]");
          if (elems.length) { await safeClick(elems[0]); await sleep(1500); }
        }
      } catch {}

      // Type URL di omnibox atas (EN: "Inspect any URL", ID: "Inspeksi URL apa pun")
      const topInput = await page.waitForSelector(
        'input[jsname="dSO9oc"], input[aria-label*="Inspect any URL"], input[aria-label*="Inspeksi URL"]',
        { timeout: 30000, visible: true }
      );
      console.log(`[run] #${current} omnibox ketemu, ketik URL...`);
      await topInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await sleep(300);
      await topInput.type(url, { delay: 25 });
      await sleep(500);

      // Pastikan URL benar2 masuk; kalau kosong (fokus gagal) → set via JS
      const typedOk = await page.evaluate((u) => {
        const el = document.querySelector('input[jsname="dSO9oc"]') ||
                   document.querySelector('input[aria-label*="Inspect any URL"]') ||
                   document.querySelector('input[aria-label*="Inspeksi URL"]');
        if (!el) return false;
        if (el.value && el.value.length > 5) return true;
        el.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, u);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return !!el.value;
      }, url);
      if (!typedOk) throw new Error('Gagal ketik URL di omnibox (input tidak ketemu/fokus)');
      await sleep(400);
      await page.keyboard.press('Enter');
      console.log(`[run] #${current} Enter ditekan, nunggu hasil inspeksi...`);

      // Nunggu hasil inspeksi: tombol "Request indexing" ATAU "Test live URL" muncul (EN/ID)
      await page.waitForFunction(
        () => {
          const sp = document.querySelectorAll('div[role="button"] span');
          for (const s of sp) {
            const t = (s.textContent || '').trim();
            if (t === 'Request indexing' || t === 'Minta pengindeksan' ||
                t === 'Test live URL' || t === 'Uji URL versi langsung') return true;
          }
          if (document.querySelector('div[role="button"][aria-label*="Request indexing"], div[role="button"][aria-label*="Minta pengindeksan"]')) return true;
          return false;
        },
        { timeout: INSPECT_TIMEOUT, polling: 1500 }
      );
      console.log(`[run] #${current} hasil inspeksi siap → klik Request indexing`);
      await sleep(1500);

      // Klik "Request indexing"
      const reqBtn = await page.evaluateHandle(() => {
        const aria = document.querySelector('div[role="button"][aria-label*="Request indexing"]');
        if (aria) return aria;
        const btns = document.querySelectorAll('div[role="button"]');
        for (const b of btns) {
          const spans = b.querySelectorAll('span');
          for (const s of spans) {
            const t = (s.textContent || '').trim();
            if (t === 'Request indexing' || t === 'Minta pengindeksan') return b;
          }
        }
        return null;
      });
      const reqEl = reqBtn.asElement ? reqBtn.asElement() : reqBtn;
      if (!reqEl) throw new Error('Request indexing button not found');
      await safeClick(reqEl);

      await sleep(1500);

      let stateResult = 'TIMEOUT';
      try {
        await page.waitForFunction(
          () => {
            const text = (document.body.innerText || '').toLowerCase();
            if (text.includes('testing if live url') || text.includes('menguji url')) return false; // masih loading
            const quota = text.includes('quota') || text.includes('kuota') ||
                          text.includes('exceeded') || text.includes('melampaui') || text.includes('melebihi') ||
                          text.includes('try again later') || text.includes('coba lagi nanti');
            const ok = text.includes('indexing requested') || text.includes('pengindeksan diminta') ||
                       text.includes('permintaan pengindeksan') || text.includes('priority crawl') ||
                       text.includes('antrean prioritas') || text.includes('ditambahkan ke antrean') ||
                       text.includes('antrean perayapan');
            return quota || ok;
          },
          { timeout: RESULT_TIMEOUT, polling: 2000 }
        );
        stateResult = await page.evaluate(() => {
          const text = (document.body.innerText || '').toLowerCase();
          if (text.includes('quota') || text.includes('kuota') ||
              text.includes('exceeded') || text.includes('melampaui') || text.includes('melebihi') ||
              text.includes('try again later') || text.includes('coba lagi nanti')) return 'QUOTA';
          if (text.includes('indexing requested') || text.includes('pengindeksan diminta') ||
              text.includes('permintaan pengindeksan') || text.includes('priority crawl') ||
              text.includes('antrean prioritas') || text.includes('ditambahkan ke antrean') ||
              text.includes('antrean perayapan')) return 'SUCCESS';
          return 'UNKNOWN';
        });
      } catch {
        stateResult = 'TIMEOUT';
      }

      // Tutup popup
      await page.keyboard.press('Escape');
      await sleep(800);

      if (stateResult === 'SUCCESS') {
        indexed = true;
      } else if (stateResult === 'QUOTA') {
        indexErr = 'Quota exceeded';
        reason = 'QUOTA';
      } else {
        indexErr = stateResult;
        reason = stateResult;
      }
    } catch (e) {
      indexErr = (e.message || 'error').slice(0, 120);
      reason = 'ERROR';
      // DEBUG: simpan screenshot + info layar biar ketahuan kenapa index mandek
      try {
        const debugDir = path.resolve(process.cwd(), '_debug');
        fs.mkdirSync(debugDir, { recursive: true });
        const shot = path.join(debugDir, `run-index-fail-${current}-${Date.now()}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        const info = await page.evaluate(() => ({
          url: location.href,
          sidebar: !!document.querySelector('a[jsname="YhhZY"]'),
          omnibox: !!document.querySelector('input[jsname="dSO9oc"]'),
          omniboxVal: (document.querySelector('input[jsname="dSO9oc"]') || {}).value || '',
          inputs: Array.from(document.querySelectorAll('input')).map(i => i.getAttribute('aria-label') || i.getAttribute('jsname') || '').filter(Boolean).slice(0, 12),
          buttons: Array.from(document.querySelectorAll('div[role="button"] span.RveJvd')).map(s => (s.textContent || '').trim()).filter(Boolean).slice(0, 30),
        }));
        console.log(`\n[run][INDEX-FAIL #${current}] ${url}`);
        console.log('   error    :', indexErr);
        console.log('   page url :', info.url);
        console.log('   sidebar  :', info.sidebar, '| omnibox:', info.omnibox, '| omniboxVal:', JSON.stringify(info.omniboxVal));
        console.log('   inputs   :', JSON.stringify(info.inputs));
        console.log('   buttons  :', JSON.stringify(info.buttons));
        console.log('   screenshot:', shot, '\n');
      } catch (de) {
        console.log('[run] debug capture gagal:', de.message);
      }
    }

    results.push({ url, property, verified, indexed, error: indexErr, reason });
    onProgress?.({ phase: 'index', current, total, url, property, verified, indexed, reason });

    await sleep(rand(3000, 6000));
  }

  await browser.close();
  return { root: rootStatus, results };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => Math.floor(Math.random() * (b - a) + a);

module.exports = {
  downloadVerificationFiles,
  verifyProperties,
  requestIndexAll,
  verifyAndIndexAll,
  deriveProperty,
  normalizeIndexUrl,
  prefixToFolderName,
};

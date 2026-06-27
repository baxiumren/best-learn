# 🤖 AutoGSC Bot — Full Pipeline

Telegram bot untuk auto-pipeline SEO MAHASLOT: generate landing pages → submit ke Google Search Console → request indexing → publish files → deploy ke Cloudflare Pages.

---

## 📦 Tech Stack

- **Node.js** 18+ (runtime)
- **Telegraf** (Telegram bot framework)
- **Puppeteer Extra + Stealth** (Chrome automation, anti-detection)
- **Archiver** (zip compression)
- **Axios** (HTTP client)
- **PHP** 7.4+ (built-in server untuk generator script)
- **Wrangler CLI** (Cloudflare Pages deploy)

---

## 🔧 Installation

### 1. Clone / copy project
```bash
cd E:\acfolder\acfolder\autogsc
```

### 2. Install dependencies
```bash
npm install
```

### 3. Install wrangler (untuk /cfpages)
```bash
npm install -g wrangler
```

### 4. Install PHP (untuk generator)
- Download dari https://windows.php.net/download/
- Add `php.exe` ke PATH
- Test: `php -v` (harus muncul versi)

### 5. Setup `.env`

Copy `.env.example` ke `.env`, isi credential:

```env
# Telegram
TELEGRAM_TOKEN=your_bot_token_here
ALLOWED_USER_IDS=881552619

# PHP server (auto-start saat npm start)
PHP_PORT=1515
PHP_ROOT=../

# acfolder paths (relative to autogsc/)
ACFOLDER_ROOT=..
ACFOLDER_TARGETS_FILE=../domain_target.txt
ACFOLDER_BRANDS_FILE=../list_brand.txt
ACFOLDER_IMAGES_FILE=../list_image.txt
ACFOLDER_RESULT_PATH=../result/template_result
ACFOLDER_AMP_RESULT_PATH=../result/amp_result/amp
ACFOLDER_TEMPLATE_FILE=../template.php
ACFOLDER_TEMPLATE_AMP_FILE=../template_amp.php
ACFOLDER_STOCK_TEMPLATE_DIR=../stock_template
ACFOLDER_STOCK_AMP_DIR=../stock_amp
ACFOLDER_PING_FILE=../ping.php
ACFOLDER_ROBOTS_FILE=../robots.txt
ACFOLDER_SITEMAP_GEN_DIR=../sitemapgenerator
ACFOLDER_SITEMAP_DOMAIN_FILE=../sitemapgenerator/sitemap_domain.txt
ACFOLDER_SITEMAP_OUTPUT=../sitemapgenerator/sitemap.xml
ACFOLDER_GENERATOR_URL=http://localhost:1515/
ACFOLDER_SITEMAP_GEN_URL=http://localhost:1515/sitemapgenerator/sitemap_generator.php

# Publish files (kodokzuma.gaterlaluyakin.xyz)
PUBLISH_BASE_URL=https://kodokzuma.gaterlaluyakin.xyz/
PUBLISH_USERNAME=suparmanto
PUBLISH_PASSWORD=supratbromantap2

# Cloudflare Pages (untuk /cfpages)
# Mode 1: Global API Key (legacy)
CLOUDFLARE_EMAIL=your_cf_email@example.com
CLOUDFLARE_API_KEY=your_cf_global_api_key
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Mode 2: API Token (modern, optional)
# CLOUDFLARE_API_TOKEN=your_api_token
```

### 6. Login Google Chrome (manual, sekali)

Chrome profile akan auto-create saat bot pertama jalan. Login Google account yang punya akses GSC.

---

## 🚀 Run

```bash
npm start
```

Expected output:
```
🤖 Bot starting...
👥 Allowed users: 881552619
🚀 Starting PHP server: 127.0.0.1:1515
✅ PHP server up at http://127.0.0.1:1515/
✅ Bot LIVE & listening Telegram!
```

---

## 📋 Bot Commands

### 1️⃣ INPUT FILES
- `/show targets|brands|images` — view file content
- `/check` — validate sync (targets/brands/images count match)
- `/edit <type>` — replace content via paste
- `/append <type>` — add content
- `/upload <type>` — upload .txt file (auto-check duplicates)
- `/done` / `/cancel` — finish editing

### 2️⃣ DOMAIN SETUP
- `/setdomain` — set domain (auto-edit ping.php + robots.txt)
- `/showdomain` — show current domain

### 3️⃣ TEMPLATE PICKER
- `/picktemplate` — pick LP from stock_template/
- `/pickamp` — pick AMP from stock_amp/

### 4️⃣ TITLE & DESCRIPTION
- `/showtitle` / `/edittitle` — view/edit title
- `/showdesc` / `/editdesc` — view/edit description
- ⚠️ Must include `{BRAND}` placeholder

### 5️⃣ ASSETS
- `/showassets` — view current assets
- `/setassets` — wizard 1-per-1 (banner/logo/favicon/etc)

### 6️⃣ GENERATE
- `/generate` — trigger acfolder/index.php (creates 200 LP files)
- `/gensitemap` — generate sitemap.xml from targets

### 7️⃣ GSC INDEXING
- `/scantargets` — analyze sitemap.xml → hierarchical prefix (max 10 URL/property)
- `/prepareinto <domain>` — Chrome auto-download GSC verification files
- `/ready` — confirm login Google manual (saat prepareinto)
- `/cancellogin` — batalin login wait
- `/verify <domain>` — auto-click verify di GSC
- `/index <domain>` — submit URL Inspection request (manual chrome, NOT API)

### 8️⃣ ZIP & PUBLISH
- `/zip` — zip template_result + amp_result, send to chat
- `/publishfiles` — auto-upload 5 TXT + 2 ZIP ke kodokzuma → return URL list

### 9️⃣ CLOUDFLARE PAGES
- `/cfpages <name>` — deploy amp_result/amp ke CF Pages
  - Example: `/cfpages mahaslot-amp`
  - Output: `https://<name>.pages.dev`

### 🧰 UTILITY
- `/list` — list all domains
- `/status <domain>` — show progress
- `/delete <domain>` — delete domain data
- `/cleanfiles <domain>` — clean GSC files
- `/reset` — nuclear reset (delete all)

---

## 🔄 Full Pipeline Workflow

```
1. /upload targets    (upload domain_target.txt)
2. /upload brands     (upload list_brand.txt)
3. /upload images     (upload list_image.txt)
4. /check             (validate sync)
5. /setdomain         (set master domain)
6. /picktemplate      (pick LP template)
7. /pickamp           (pick AMP template)
8. /edittitle         (set title with {BRAND})
9. /editdesc          (set description)
10. /setassets        (set banner/logo/etc)
11. /generate         (create 200 LP files)
12. /gensitemap       (generate sitemap.xml)
13. /scantargets      (analyze prefix)
14. /prepareinto <d>  (download GSC verification)
15. /zip              (bundle files)
16. /publishfiles     (upload to kodokzuma)
17. /cfpages <name>   (deploy AMP to CF Pages)
18. /verify <d>       (verify property in GSC)
19. /index <d>        (submit URL Inspection)
```

---

## 🐛 Troubleshooting

### Bot crash saat start
- Cek `TELEGRAM_TOKEN` di `.env`
- Cek `ALLOWED_USER_IDS` (user ID Telegram lu)
- Cek node version: `node -v` (harus 18+)

### PHP server gak start
- Cek PHP installed: `php -v`
- Add PHP ke PATH
- Atau start manual: `php -S localhost:1515 -t E:\acfolder\acfolder`

### /generate error
- Pastikan PHP server running di port 1515
- Cek `ACFOLDER_GENERATOR_URL` di `.env`

### /prepareinto: Chrome closed before login
- Setelah Chrome buka, login Google manual
- Kirim `/ready` di Telegram setelah dashboard GSC keluar
- Bot bakal wait max 10 menit

### /publishfiles: kodokzuma login error
- Cek credential di `.env`
- Hapus folder `chrome-profile-uploader/` → bot create fresh + login ulang

### /cfpages: Authentication error
- Cek `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` di `.env`
- Atau pakai API Token: `CLOUDFLARE_API_TOKEN`
- Get token dari https://dash.cloudflare.com/profile/api-tokens

### /verify: Property not in list
- Property belum di-add ke GSC manual
- Add dulu via `/prepareinto` atau manual di dashboard

### /index: Quota exceeded
- GSC limit 10 URL/property/day
- Wait besok pagi (reset jam 00:00 UTC)
- Bot auto-skip ke property berikutnya

---

## 🗂️ Project Layout

Liat `PROJECT_STRUCTURE.md` untuk detail file structure + lokasi command + handover notes.

---

## 🛡️ Security Notes

- `.env` jangan commit ke git
- Cloudflare token = scope minimal (Pages Edit only kalau pakai API Token)
- Chrome profile berisi session login → backup folder ini kalau pindah PC

---

## 📞 Support

- Issue: cek terminal log dulu
- Stuck: restart bot (Ctrl+C → npm start)
- Total reset: `/reset` di Telegram (delete semua domain data)

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-05-18

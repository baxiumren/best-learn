module.exports = `🤖 AutoGSC Bot — full pipeline

1️⃣ INPUT FILES
/show targets | brands | images
/check
/edit <type>  · /append <type>  · /upload <type>
/done · /cancel

2️⃣ DOMAIN SETUP
/setdomain    — set domain (auto-edit ping.php + robots.txt)
/showdomain   — lihat domain sekarang

3️⃣ TEMPLATE PICKER
/picktemplate — pilih dari stock_template
/pickamp      — pilih dari stock_amp

4️⃣ TITLE & DESCRIPTION
/showtitle · /edittitle
/showdesc  · /editdesc
(harus include {BRAND} di text baru)

5️⃣ ASSETS
/showassets · /setassets (wizard 1-per-1)

6️⃣ GENERATE
/generate    — trigger acfolder/index.php
/gensitemap  — generate sitemap.xml dari targets

7️⃣ GSC INDEXING
/scantargets · /prepareinto <domain>
/ready  — confirm udah login Google (saat prepareinto)
/cancellogin — batalin login wait
/verify <domain> · /index <domain>
/retryindex <domain> — re-try failed URLs dari last /index

8️⃣ ZIP & PUBLISH
/zip — zip template_result (skip _debug,_temp) + amp_result/amp
       lalu kirim file zip ke chat
/publishfiles — auto upload semua file ke kodokzuma
       (5 TXT + 2 ZIP terbaru → kirim list URL ke chat)

9️⃣ CLOUDFLARE PAGES
/cfpages <name> — deploy amp_result/amp ke CF Pages
       Contoh: /cfpages mahaslot-amp
       Output: https://<name>.pages.dev

🔐 CHROME PROFILE (Multi-Gmail)
/profiles            — list semua profile + active
/whoami              — show active profile
/newprofile <nama>   — bikin profile baru
/useprofile <nama>   — switch ke profile itu
/delprofile <nama>   — hapus profile

🧰 Utility
/list · /status <domain> · /delete <domain> · /reset`;

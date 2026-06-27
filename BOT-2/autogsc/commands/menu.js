// ── /menu + /start inline keyboard ─────────────────────────────────────────
module.exports = (bot) => {

  const MAIN_MENU = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '1️⃣ Input Files',    callback_data: 'menu:input'    },
          { text: '2️⃣ Domain Setup',   callback_data: 'menu:domain'   },
          { text: '3️⃣ Template',       callback_data: 'menu:template' },
        ],
        [
          { text: '4️⃣ Title & Desc',   callback_data: 'menu:meta'     },
          { text: '5️⃣ Assets',         callback_data: 'menu:assets'   },
          { text: '6️⃣ Generate',       callback_data: 'menu:generate' },
        ],
        [
          { text: '7️⃣ GSC Indexing',   callback_data: 'menu:gsc'      },
          { text: '8️⃣ ZIP & Publish',  callback_data: 'menu:publish'  },
          { text: '9️⃣ CF Pages',       callback_data: 'menu:cfpages'  },
        ],
        [
          { text: '🔐 Profiles',        callback_data: 'menu:profiles' },
          { text: '🧰 Utility',         callback_data: 'menu:utility'  },
        ],
      ]
    }
  };

  const back = { text: '⬅️ Menu Utama', callback_data: 'menu:main' };

  const SUBS = {
    'menu:input': {
      text: `1️⃣ *INPUT FILES*

Pilih file yang mau dikelola:

\`TARGETS\`
> ┗▶ Daftar URL domain tujuan

\`BRANDS\`
> ┗▶ Daftar nama brand

\`IMAGES\`
> ┗▶ Daftar URL gambar per brand`,
      buttons: [
        [
          { text: '🎯 TARGETS', callback_data: 'menu:input:targets' },
          { text: '🏷️ BRANDS',  callback_data: 'menu:input:brands'  },
          { text: '🖼️ IMAGES',  callback_data: 'menu:input:images'  },
        ],
        [
          { text: '✅ Check Semua', callback_data: 'run:check' },
        ],
        [back],
      ]
    },
    'menu:input:targets': {
      text: `1️⃣ *INPUT FILES — TARGETS*

📌 *Apa itu?*
> ┗▶ Daftar URL domain tujuan
> ┗▶ Jumlah baris harus sama dengan Brands & Images

✏️ *Cara Edit — ketik manual:*
> ┗▶ Klik *Edit* → langsung paste teks di chat
> ┗▶ Kirim \`/done\` untuk simpan, \`/cancel\` batal
> \`\`\`
> https://domain.com/2024/01/
> https://domain2.com/promo/
> \`\`\`

📤 *Cara Upload — kirim file .txt:*
> ┗▶ Klik *Upload* → kirim file \`.txt\` ke chat
> ┗▶ Auto cek duplikat sebelum disimpan
> ┗▶ File lama otomatis di-backup

➕ *Append — tambah tanpa hapus:*
> ┗▶ Klik *Append* → paste baris tambahan`,
      buttons: [
        [
          { text: '📋 Show',   callback_data: 'run:show targets'    },
          { text: '✏️ Edit',   callback_data: 'run:edit targets'    },
        ],
        [
          { text: '📤 Upload', callback_data: 'run:upload targets'  },
          { text: '➕ Append', callback_data: 'run:append targets'  },
        ],
        [{ text: '⬅️ Input Files', callback_data: 'menu:input' }],
      ]
    },
    'menu:input:brands': {
      text: `1️⃣ *INPUT FILES — BRANDS*

📌 *Apa itu?*
> ┗▶ Daftar nama brand, satu per baris
> ┗▶ Jumlah baris harus sama dengan Targets & Images

✏️ *Cara Edit — ketik manual:*
> ┗▶ Klik *Edit* → langsung paste teks di chat
> ┗▶ Kirim \`/done\` untuk simpan, \`/cancel\` batal
> \`\`\`
> MAHASLOT
> SUKATOTO
> ROYALBOLA
> \`\`\`

📤 *Cara Upload — kirim file .txt:*
> ┗▶ Klik *Upload* → kirim file \`.txt\` ke chat
> ┗▶ Auto cek duplikat sebelum disimpan`,
      buttons: [
        [
          { text: '📋 Show',   callback_data: 'run:show brands'   },
          { text: '✏️ Edit',   callback_data: 'run:edit brands'   },
          { text: '📤 Upload', callback_data: 'run:upload brands' },
        ],
        [{ text: '⬅️ Input Files', callback_data: 'menu:input' }],
      ]
    },
    'menu:input:images': {
      text: `1️⃣ *INPUT FILES — IMAGES*

📌 *Apa itu?*
> ┗▶ Daftar URL gambar untuk tiap brand
> ┗▶ Urutan harus sama persis dengan Brands

✏️ *Cara Edit — ketik manual:*
> ┗▶ Klik *Edit* → langsung paste teks di chat
> ┗▶ Kirim \`/done\` untuk simpan, \`/cancel\` batal
> \`\`\`
> https://img.com/mahaslot.jpg
> https://img.com/sukatoto.jpg
> \`\`\`

📤 *Cara Upload — kirim file .txt:*
> ┗▶ Klik *Upload* → kirim file \`.txt\` ke chat
> ┗▶ Auto cek duplikat sebelum disimpan`,
      buttons: [
        [
          { text: '📋 Show',   callback_data: 'run:show images'   },
          { text: '✏️ Edit',   callback_data: 'run:edit images'   },
          { text: '📤 Upload', callback_data: 'run:upload images' },
        ],
        [{ text: '⬅️ Input Files', callback_data: 'menu:input' }],
      ]
    },
    'menu:domain': {
      text: `2️⃣ *DOMAIN SETUP*

\`Show Domain\`
> ┗▶ Lihat domain yang sedang aktif dipakai

\`Set Domain\`
> ┗▶ Ganti domain aktif
> ┗▶ Auto update \`ping.php\` & \`robots.txt\`
> ┗▶ Cara: ketik \`/setdomain <domain>\`
> ┗▶ Contoh: \`/setdomain mahaslot.me\``,
      buttons: [
        [
          { text: '👀 Show Domain', callback_data: 'run:showdomain' },
          { text: '⚙️ Set Domain',  callback_data: 'run:setdomain'  },
        ],
        [back],
      ]
    },
    'menu:template': {
      text: `3️⃣ *TEMPLATE PICKER*

\`Pick Template\`
> ┗▶ Pilih template Landing Page dari stock
> ┗▶ Bot akan tampilkan daftar pilihan

\`Pick AMP\`
> ┗▶ Pilih template AMP dari stock
> ┗▶ Bot akan tampilkan daftar pilihan`,
      buttons: [
        [
          { text: '📄 Pick Template', callback_data: 'run:picktemplate' },
          { text: '📄 Pick AMP',      callback_data: 'run:pickamp'      },
        ],
        [back],
      ]
    },
    'menu:meta': {
      text: `4️⃣ *TITLE & DESCRIPTION*

Pilih yang mau diedit:

\`TITLE\`
> ┗▶ Title halaman SEO

\`DESC\`
> ┗▶ Meta description halaman

⚠️ Wajib include \`{BRAND}\` di teks baru`,
      buttons: [
        [
          { text: '📝 TITLE', callback_data: 'menu:meta:title' },
          { text: '📝 DESC',  callback_data: 'menu:meta:desc'  },
        ],
        [back],
      ]
    },
    'menu:meta:title': {
      text: `4️⃣ *TITLE & DESCRIPTION — TITLE*

\`Show Title\`
> ┗▶ Lihat title yang sedang aktif

\`Edit Title\`
> ┗▶ Klik Edit → kirim teks baru di chat
> ┗▶ Wajib include \`{BRAND}\`, contoh:
> \`\`\`
> {BRAND} : Slot Gacor Malam Ini 2026
> \`\`\``,
      buttons: [
        [
          { text: '👀 Show Title',  callback_data: 'run:showtitle' },
          { text: '✏️ Edit Title', callback_data: 'run:edittitle' },
        ],
        [{ text: '⬅️ Title & Desc', callback_data: 'menu:meta' }],
      ]
    },
    'menu:meta:desc': {
      text: `4️⃣ *TITLE & DESCRIPTION — DESC*

\`Show Desc\`
> ┗▶ Lihat deskripsi yang sedang aktif

\`Edit Desc\`
> ┗▶ Klik Edit → kirim teks baru di chat
> ┗▶ Wajib include \`{BRAND}\`, contoh:
> \`\`\`
> {BRAND} hadir sebagai situs slot terpercaya...
> \`\`\``,
      buttons: [
        [
          { text: '👀 Show Desc',  callback_data: 'run:showdesc' },
          { text: '✏️ Edit Desc', callback_data: 'run:editdesc' },
        ],
        [{ text: '⬅️ Title & Desc', callback_data: 'menu:meta' }],
      ]
    },
    'menu:assets': {
      text: `5️⃣ *ASSETS*

\`Show Assets\`
> ┗▶ Lihat semua asset yang sedang aktif
> ┗▶ Favicon, logo, AMP image, money site, dll

\`Set Assets\`
> ┗▶ Wizard 1 per 1 — bot tanya satu-satu
> ┗▶ Kirim URL asset yang diminta
> ┗▶ Ketik \`/skip\` untuk lewati & pakai nilai lama`,
      buttons: [
        [
          { text: '👀 Show Assets', callback_data: 'run:showassets' },
          { text: '⚙️ Set Assets',  callback_data: 'run:setassets'  },
        ],
        [back],
      ]
    },
    'menu:generate': {
      text: `6️⃣ *GENERATE*

\`Generate\`
> ┗▶ Buat folder hasil dari list brand + domain
> ┗▶ Output: \`template_result/\` & \`amp_result/amp/\`
> ┗▶ Pastikan Input Files & Assets sudah di-set

\`Gen Sitemap\`
> ┗▶ Generate \`sitemap.xml\` dari targets
> ┗▶ File dikirim langsung ke chat setelah selesai`,
      buttons: [
        [
          { text: '⚡ Generate',     callback_data: 'run:generate'   },
          { text: '🗺️ Gen Sitemap', callback_data: 'run:gensitemap' },
        ],
        [back],
      ]
    },
    'menu:gsc': {
      text: `7️⃣ *GSC INDEXING*

\`Scan Targets\`
> ┗▶ Baca sitemap/targets, siapkan data domain

\`Prepareinto\`
> ┗▶ Buka Chrome, ambil file verifikasi GSC

\`Ready\`
> ┗▶ Konfirmasi sudah login GSC, lanjut proses

\`Run <domain>\`
> ┗▶ *All-in-one* — verify + index sekaligus
> ┗▶ 1 URL = 1 property, loop sampai habis

\`Verify / Index\`
> ┗▶ Manual: verify saja atau index saja

\`Cancel Login\`
> ┗▶ Batalkan proses login yang sedang menunggu`,
      buttons: [
        [{ text: '🔎 Scan Targets',  callback_data: 'run:scantargets'  }],
        [
          { text: '⚙️ Prepareinto', callback_data: 'hint:prepareinto' },
          { text: '✅ Ready',        callback_data: 'run:ready'        },
          { text: '❌ Cancel',       callback_data: 'run:cancellogin'  },
        ],
        [{ text: '🚀 Run (verify+index)', callback_data: 'hint:run'   }],
        [
          { text: '🔄 Verify',      callback_data: 'hint:verify'      },
          { text: '📑 Index',       callback_data: 'hint:index'       },
        ],
        [back],
      ]
    },
    'menu:publish': {
      text: `8️⃣ *ZIP & PUBLISH*

\`ZIP\`
> ┗▶ Zip folder \`template_result\` + \`amp_result/amp\`
> ┗▶ File ZIP dikirim langsung ke chat

\`Publish Files\`
> ┗▶ Auto upload semua file ke hosting
> ┗▶ Upload 5 TXT + 2 ZIP terbaru
> ┗▶ Kirim list URL hasil upload ke chat`,
      buttons: [
        [
          { text: '📦 ZIP',           callback_data: 'run:zip'          },
          { text: '🚀 Publish Files', callback_data: 'run:publishfiles' },
        ],
        [back],
      ]
    },
    'menu:cfpages': {
      text: `9️⃣ *CLOUDFLARE PAGES*

\`Deploy CF Pages\`
> ┗▶ Deploy folder \`amp_result/amp\` ke CF Pages
> ┗▶ Cara: \`/cfpages <nama-project>\`
> ┗▶ Contoh: \`/cfpages mahaslot-amp\`
> ┗▶ Output: \`https://<nama>.pages.dev\``,
      buttons: [
        [{ text: '🚀 Deploy CF Pages', callback_data: 'hint:cfpages' }],
        [back],
      ]
    },
    'menu:profiles': {
      text: `🔐 *CHROME PROFILES*

\`List Profiles\`
> ┗▶ Lihat semua profile + yang sedang aktif

\`Who Am I\`
> ┗▶ Lihat profile Chrome yang sedang dipakai

\`New Profile\`
> ┗▶ Buat profile Gmail baru
> ┗▶ Cara: \`/newprofile <nama>\`

\`Use Profile\`
> ┗▶ Ganti ke profile lain
> ┗▶ Cara: \`/useprofile <nama>\`

\`Del Profile\`
> ┗▶ Hapus profile
> ┗▶ Cara: \`/delprofile <nama>\``,
      buttons: [
        [
          { text: '📋 List Profiles', callback_data: 'run:profiles' },
          { text: '🙋 Who Am I',      callback_data: 'run:whoami'   },
        ],
        [
          { text: '➕ New Profile',   callback_data: 'hint:newprofile'  },
          { text: '🔄 Use Profile',   callback_data: 'hint:useprofile'  },
          { text: '🗑️ Del Profile',   callback_data: 'hint:delprofile'  },
        ],
        [back],
      ]
    },
    'menu:utility': {
      text: `🧰 *UTILITY*

\`List\`
> ┗▶ Lihat semua domain yang tersimpan

\`Reset\`
> ┗▶ Reset semua data GSC ke default
> ┗▶ ⚠️ Hati-hati — tidak bisa di-undo

\`Clear Result\`
> ┗▶ Hapus isi folder \`template_result/\`, \`amp_result/\`, \`_zips/\`
> ┗▶ Folder tetap ada, isinya dikosongkan
> ┗▶ ⚠️ Hati-hati — tidak bisa di-undo`,
      buttons: [
        [
          { text: '📋 List',         callback_data: 'run:list'        },
          { text: '🔄 Reset',        callback_data: 'run:reset'       },
        ],
        [{ text: '🗑️ Clear Result', callback_data: 'run:clearresult' }],
        [back],
      ]
    },
  };

  const HINTS = {
    'hint:setdomain'  : '⚙️ Ketik:\n`/setdomain <domain>`\nContoh: `/setdomain mahaslot.me`',
    'hint:prepareinto': '⚙️ Ketik:\n`/prepareinto <domain>`',
    'hint:verify'     : '⚙️ Ketik:\n`/verify <domain>`',
    'hint:index'      : '⚙️ Ketik:\n`/index <domain>`',
    'hint:cfpages'    : '⚙️ Ketik:\n`/cfpages <nama>`\nContoh: `/cfpages mahaslot-amp`',
    'hint:newprofile' : '⚙️ Ketik:\n`/newprofile <nama>`',
    'hint:useprofile' : '⚙️ Ketik:\n`/useprofile <nama>`',
    'hint:delprofile' : '⚙️ Ketik:\n`/delprofile <nama>`',
    'hint:run'        : '⚙️ Ketik:\n`/run <domain>`\nContoh: `/run mahaslot.me`',
  };

  // Trigger command via bot.handleUpdate ──────────────────────────────────
  async function runCommand(bot, ctx, command) {
    const text = command.startsWith('/') ? command : '/' + command;
    await bot.handleUpdate({
      update_id: 0,
      message: {
        message_id: Date.now(),
        from      : ctx.callbackQuery.from,
        chat      : ctx.callbackQuery.message.chat,
        date      : Math.floor(Date.now() / 1000),
        text,
        entities  : [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }],
      }
    });
  }

  const MENU_TEXT = `🤖 *AutoGSC Bot — Main Menu*

\`📂 Input Files\`
> ┗▶ Kelola list brand, image & domain target

\`🌐 Domain Setup\`
> ┗▶ Set & lihat domain aktif

\`🎨 Template\`
> ┗▶ Pilih template LP atau AMP

\`✏️ Title & Desc\`
> ┗▶ Edit title & deskripsi SEO

\`🖼️ Assets\`
> ┗▶ Set favicon, logo, AMP image, dll

\`⚡ Generate\`
> ┗▶ Buat folder hasil template \\+ AMP

\`🔍 GSC Indexing\`
> ┗▶ Scan & submit URL ke Google Search Console

\`📦 ZIP & Publish\`
> ┗▶ Zip hasil & upload ke hosting

\`☁️ CF Pages\`
> ┗▶ Deploy AMP ke Cloudflare Pages

\`🔐 Profiles\`
> ┗▶ Manage multi\\-Gmail Chrome profile

\`🧰 Utility\`
> ┗▶ List, reset, dan lainnya`;

  // /start — langsung tampil menu ─────────────────────────────────────────
  bot.start((ctx) => {
    ctx.reply(MENU_TEXT, MAIN_MENU);
  });

  // /menu ─────────────────────────────────────────────────────────────────
  bot.command('menu', (ctx) => {
    ctx.reply(MENU_TEXT, MAIN_MENU);
  });

  // Callback handler ──────────────────────────────────────────────────────
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    // Main menu
    if (data === 'menu:main') {
      return ctx.editMessageText('🤖 *AutoGSC Bot*\n\nPilih aksi:', MAIN_MENU);
    }

    // Sub menu
    if (SUBS[data]) {
      const sub = SUBS[data];
      return ctx.editMessageText(sub.text, {
        parse_mode  : 'Markdown',
        reply_markup: { inline_keyboard: sub.buttons },
      });
    }

    // Hint — command butuh argumen
    if (data.startsWith('hint:')) {
      return ctx.reply(HINTS[data] || '⚙️ Ketik command-nya manual.', { parse_mode: 'Markdown' });
    }

    // Run command langsung
    if (data.startsWith('run:')) {
      const cmd = data.replace('run:', '');
      try {
        await runCommand(bot, ctx, cmd);
      } catch (e) {
        ctx.reply(`❌ Error menjalankan command: ${e.message}`);
      }
    }
  });
};

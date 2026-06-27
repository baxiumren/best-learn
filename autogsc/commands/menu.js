// ── /menu — inline keyboard main menu ──────────────────────────────────────
module.exports = (bot) => {

  const MAIN_MENU = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📂 Input Files',   callback_data: 'menu:input'    },
          { text: '🌐 Domain Setup',  callback_data: 'menu:domain'   },
        ],
        [
          { text: '🎨 Template',      callback_data: 'menu:template' },
          { text: '✏️ Title & Desc',  callback_data: 'menu:meta'     },
        ],
        [
          { text: '🖼️ Assets',        callback_data: 'menu:assets'   },
          { text: '⚡ Generate',      callback_data: 'menu:generate' },
        ],
        [
          { text: '🔍 GSC Indexing',  callback_data: 'menu:gsc'      },
          { text: '📦 ZIP & Publish', callback_data: 'menu:publish'  },
        ],
        [
          { text: '☁️ CF Pages',      callback_data: 'menu:cfpages'  },
          { text: '🔐 Profiles',      callback_data: 'menu:profiles' },
        ],
        [
          { text: '🧰 Utility',       callback_data: 'menu:utility'  },
          { text: '📖 Help Lengkap',  callback_data: 'menu:help'     },
        ],
      ]
    }
  };

  const BACK_BTN = [[{ text: '⬅️ Kembali ke Menu', callback_data: 'menu:main' }]];

  const SUB_MENUS = {
    'menu:input': {
      text: '📂 *INPUT FILES*\n\nKelola file targets, brands, dan images:',
      buttons: [
        [
          { text: '📋 Show Targets',  callback_data: 'cmd:show targets'  },
          { text: '📋 Show Brands',   callback_data: 'cmd:show brands'   },
        ],
        [
          { text: '📋 Show Images',   callback_data: 'cmd:show images'   },
          { text: '✅ Check',         callback_data: 'cmd:check'         },
        ],
        [
          { text: '✏️ Edit Targets',  callback_data: 'cmd:edit targets'  },
          { text: '✏️ Edit Brands',   callback_data: 'cmd:edit brands'   },
        ],
        [
          { text: '➕ Append Targets',callback_data: 'cmd:append targets'},
          { text: '✏️ Edit Images',   callback_data: 'cmd:edit images'   },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:domain': {
      text: '🌐 *DOMAIN SETUP*',
      buttons: [
        [
          { text: '👀 Show Domain',  callback_data: 'cmd:showdomain' },
        ],
        [
          { text: '⚙️ Set Domain',  callback_data: 'cmd:setdomain_prompt' },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:template': {
      text: '🎨 *TEMPLATE PICKER*\n\nPilih template yang mau dipakai:',
      buttons: [
        [
          { text: '📄 Pick Template', callback_data: 'cmd:picktemplate' },
          { text: '📄 Pick AMP',      callback_data: 'cmd:pickamp'      },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:meta': {
      text: '✏️ *TITLE & DESCRIPTION*\n\n_Harus include {BRAND} di text baru_',
      buttons: [
        [
          { text: '👀 Show Title',  callback_data: 'cmd:showtitle'  },
          { text: '✏️ Edit Title', callback_data: 'cmd:edittitle'  },
        ],
        [
          { text: '👀 Show Desc',   callback_data: 'cmd:showdesc'   },
          { text: '✏️ Edit Desc',  callback_data: 'cmd:editdesc'   },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:assets': {
      text: '🖼️ *ASSETS*\n\nKelola favicon, logo, AMP image, dll:',
      buttons: [
        [
          { text: '👀 Show Assets', callback_data: 'cmd:showassets' },
          { text: '⚙️ Set Assets', callback_data: 'cmd:setassets'  },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:generate': {
      text: '⚡ *GENERATE*\n\nBuat folder template & AMP result:',
      buttons: [
        [
          { text: '⚡ Generate Sekarang', callback_data: 'cmd:generate'   },
          { text: '🗺️ Gen Sitemap',       callback_data: 'cmd:gensitemap' },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:gsc': {
      text: '🔍 *GSC INDEXING*',
      buttons: [
        [
          { text: '🔎 Scan Targets', callback_data: 'cmd:scantargets' },
        ],
        [
          { text: '✅ Ready',         callback_data: 'cmd:ready'       },
          { text: '❌ Cancel Login',  callback_data: 'cmd:cancellogin' },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:publish': {
      text: '📦 *ZIP & PUBLISH*',
      buttons: [
        [
          { text: '📦 ZIP',           callback_data: 'cmd:zip'          },
          { text: '🚀 Publish Files', callback_data: 'cmd:publishfiles' },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:cfpages': {
      text: '☁️ *CLOUDFLARE PAGES*\n\nKetik nama project setelah klik deploy:',
      buttons: [
        [
          { text: '🚀 Deploy CF Pages', callback_data: 'cmd:cfpages_prompt' },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:profiles': {
      text: '🔐 *CHROME PROFILES*\n\nManage multi-Gmail profile:',
      buttons: [
        [
          { text: '📋 List Profiles', callback_data: 'cmd:profiles' },
          { text: '🙋 Who Am I',      callback_data: 'cmd:whoami'   },
        ],
        [
          { text: '➕ New Profile',   callback_data: 'cmd:newprofile_prompt' },
          { text: '🔄 Use Profile',   callback_data: 'cmd:useprofile_prompt' },
        ],
        BACK_BTN[0],
      ]
    },
    'menu:utility': {
      text: '🧰 *UTILITY*',
      buttons: [
        [
          { text: '📋 List',   callback_data: 'cmd:list'  },
          { text: '🔄 Reset', callback_data: 'cmd:reset' },
        ],
        BACK_BTN[0],
      ]
    },
  };

  // ── /menu command ──
  bot.command('menu', (ctx) => {
    ctx.reply('🤖 *AutoGSC Bot — Main Menu*\n\nPilih aksi:', {
      parse_mode: 'Markdown',
      ...MAIN_MENU,
    });
  });

  // ── Callback handler ──
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    // Kembali ke main menu
    if (data === 'menu:main') {
      await ctx.editMessageText('🤖 *AutoGSC Bot — Main Menu*\n\nPilih aksi:', {
        parse_mode: 'Markdown',
        ...MAIN_MENU,
      });
      return;
    }

    // Sub menu
    if (SUB_MENUS[data]) {
      const sub = SUB_MENUS[data];
      await ctx.editMessageText(sub.text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: sub.buttons },
      });
      return;
    }

    // Trigger command langsung
    if (data.startsWith('cmd:')) {
      const cmdText = '/' + data.replace('cmd:', '');

      // Prompt commands — minta user ketik lanjutannya
      const prompts = {
        'cmd:setdomain_prompt'    : '⚙️ Ketik: `/setdomain <domain>`\nContoh: `/setdomain mahaslot.me`',
        'cmd:cfpages_prompt'      : '☁️ Ketik: `/cfpages <nama-project>`\nContoh: `/cfpages mahaslot-amp`',
        'cmd:newprofile_prompt'   : '➕ Ketik: `/newprofile <nama>`',
        'cmd:useprofile_prompt'   : '🔄 Ketik: `/useprofile <nama>`',
      };

      if (prompts[data]) {
        await ctx.reply(prompts[data], { parse_mode: 'Markdown' });
        return;
      }

      // Jalankan command langsung via fake message
      await ctx.reply(`▶️ Menjalankan \`${cmdText}\`...`, { parse_mode: 'Markdown' });
      ctx.message = { ...ctx.callbackQuery.message, text: cmdText, from: ctx.callbackQuery.from };
      await bot.handleUpdate({
        update_id: 0,
        message: { ...ctx.callbackQuery.message, text: cmdText, from: ctx.callbackQuery.from, chat: ctx.callbackQuery.message.chat },
      });
    }
  });
};

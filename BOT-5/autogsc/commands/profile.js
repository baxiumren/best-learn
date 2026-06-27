const profileMgr = require('../lib/profile-manager');

/**
 * Multi-profile Chrome management.
 * Commands: /profiles, /useprofile <name>, /newprofile <name>, /delprofile <name>
 */
module.exports = function registerProfile(bot) {

  // Auto-migrate legacy chrome-profile/ → chrome-profiles/default/ on first run
  profileMgr.autoMigrateLegacy();

  bot.command('profiles', (ctx) => {
    const info = profileMgr.getProfileInfo();
    if (info.total === 0) {
      return ctx.reply('ℹ️ *Belum Ada Chrome Profile*\n\nBuat profile baru dulu:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[
          { text: '➕ New Profile', callback_data: 'hint:newprofile' },
          { text: '🏠 Menu Utama',  callback_data: 'menu:main'       },
        ]]}
      });
    }
    let txt = `🔐 *Chrome Profiles (${info.total})*\n\n`;
    info.profiles.forEach((name, i) => {
      const isActive = name === info.active;
      txt += `${i + 1}. ${isActive ? '✅' : '  '} \`${name}\`\n`;
    });
    txt += `\n• Active : \`${info.active}\``;
    ctx.reply(txt, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
      { text: '➕ New Profile', callback_data: 'hint:newprofile'  },
      { text: '🔄 Use Profile', callback_data: 'hint:useprofile'  },
      { text: '🗑️ Del Profile', callback_data: 'hint:delprofile'  },
    ],[ { text: '🏠 Menu Utama', callback_data: 'menu:main' } ]]}});
  });

  bot.command('useprofile', (ctx) => {
    const name = ctx.message.text.split(/\s+/)[1];
    if (!name) return ctx.reply('ℹ️ *Format*\n\n`/useprofile <nama>`\n💡 Contoh: `/useprofile gmail1`', { parse_mode: 'Markdown' });

    try {
      const clean = profileMgr.setActive(name);
      ctx.reply(
        `✅ *Active Profile*\n\n` +
        `• Profile : \`${clean}\`\n` +
        `• Folder  : \`chrome-profiles/${clean}/\`\n\n` +
        `💡 Kalo profile baru = belum login Google, Chrome bakal kebuka kosong, login manual sekali.`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
          { text: '🔐 List Profiles', callback_data: 'run:profiles' },
          { text: '🏠 Menu Utama',    callback_data: 'menu:main'    },
        ]]}}
      );
    } catch (e) {
      ctx.reply(`❌ *Error*\n\n${e.message}`, { parse_mode: 'Markdown' });
    }
  });

  bot.command('newprofile', (ctx) => {
    const name = ctx.message.text.split(/\s+/)[1];
    if (!name) return ctx.reply('ℹ️ *Format*\n\n`/newprofile <nama>`\n💡 Contoh: `/newprofile gmail2`', { parse_mode: 'Markdown' });

    try {
      const r = profileMgr.createProfile(name);
      let msg = r.created
        ? `✅ *Profile Baru Dibuat*\n\n• Profile : \`${r.name}\``
        : `⚠️ *Profile Sudah Ada*\n\n• Profile : \`${r.name}\``;
      ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
        { text: `✅ Pakai ${r.name}`, callback_data: `run:useprofile ${r.name}` },
        { text: '🔐 List Profiles',   callback_data: 'run:profiles'             },
      ]]}});
    } catch (e) {
      ctx.reply(`❌ *Error*\n\n${e.message}`, { parse_mode: 'Markdown' });
    }
  });

  bot.command('delprofile', (ctx) => {
    const name = ctx.message.text.split(/\s+/)[1];
    if (!name) return ctx.reply('ℹ️ *Format*\n\n`/delprofile <nama>`', { parse_mode: 'Markdown' });

    try {
      const ok = profileMgr.deleteProfile(name);
      if (!ok) return ctx.reply(`❌ *Tidak Ditemukan*\n\nProfile \`${name}\` tidak ditemukan.`, { parse_mode: 'Markdown' });
      ctx.reply(`✅ *Profile Dihapus*\n\n• Profile : \`${name}\`\n• Active  : \`${profileMgr.getActive()}\``, { parse_mode: 'Markdown' });
    } catch (e) {
      ctx.reply(`❌ *Error*\n\n${e.message}`, { parse_mode: 'Markdown' });
    }
  });

  bot.command('whoami', (ctx) => {
    const info = profileMgr.getProfileInfo();
    ctx.reply(
      `🔐 *Active Chrome Profile*\n\n` +
      `• Active : \`${info.active}\`\n` +
      `• Path   : \`${info.activePath}\`\n` +
      `• Total  : ${info.total}\n\n` +
      `• Total  : ${info.total}`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
        { text: '🔄 Use Profile', callback_data: 'hint:useprofile' },
        { text: '🔐 List Profiles', callback_data: 'run:profiles'  },
      ]]}}
    );
  });
};

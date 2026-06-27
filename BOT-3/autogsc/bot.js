require('dotenv').config();
const { Telegraf } = require('telegraf');

// ====== Auto-start PHP server (bot mulai = PHP siap) ======
require('./lib/php-server')();

// ====== Bot setup ======
const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) {
  console.error('❌ TELEGRAM_TOKEN missing. Copy .env.example to .env and fill it.');
  process.exit(1);
}

const ALLOWED = (process.env.ALLOWED_USER_IDS || '')
  .split(',')
  .map(s => parseInt(s.trim(), 10))
  .filter(n => !isNaN(n));

const bot = new Telegraf(TOKEN);

// ====== Log SEMUA update masuk (sebelum ACL, biar keliatan walau user diblok) ======
bot.use((ctx, next) => {
  const t = new Date().toLocaleTimeString();
  const from = ctx.from ? `${ctx.from.id}${ctx.from.username ? ' @' + ctx.from.username : ''}` : '?';
  let what;
  if (ctx.message && typeof ctx.message.text === 'string') what = ctx.message.text;
  else if (ctx.message && ctx.message.document) what = `[document: ${ctx.message.document.file_name}]`;
  else if (ctx.callbackQuery) what = `[callback: ${ctx.callbackQuery.data}]`;
  else what = `[${ctx.updateType}]`;
  console.log(`📩 ${t} | ${from} | ${what}`);
  return next();
});

// ====== Middleware ======
bot.use(require('./middleware/acl')(ALLOWED));
bot.use(require('./middleware/disable-preview')());

// ====== Global error handler ======
bot.catch((err, ctx) => {
  console.error('❌ BOT ERROR:', err);
  try {
    ctx.reply(`❌ Bot error: ${err.message || err}\n\nCheck terminal log.`);
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
});

// ====== /start — pinned help message ======
// /start handled in commands/menu.js

// ====== Register all command modules ======
// Order matters: text-handler harus LAST karena dia catch-all
require('./commands/menu')(bot);            // /menu — inline keyboard main menu
require('./commands/inputs')(bot);          // show/check/edit/append/upload/done/cancel + document
require('./commands/domain')(bot);          // setdomain/showdomain
require('./commands/template')(bot);        // picktemplate/pickamp
require('./commands/meta')(bot);            // showtitle/edittitle/showdesc/editdesc
require('./commands/assets')(bot);          // showassets/setassets/skip
require('./commands/scan')(bot);            // /scan <url>
require('./commands/generate')(bot);        // generate/gensitemap
require('./commands/gsc')(bot);             // scantargets/prepareinto/ready/cancellogin/prepare/verify/index
require('./commands/publish')(bot);         // zip/publishfiles/cfpages
require('./commands/utility')(bot);         // list/status/delete/cleanfiles/reset
require('./commands/profile')(bot);         // profiles/useprofile/newprofile/delprofile/whoami
require('./commands/text-handler')(bot);    // text catch-all (last)

// ====== Launch ======
console.log('🤖 Bot starting...');
console.log(`👥 Allowed users: ${ALLOWED.length ? ALLOWED.join(', ') : 'EVERYONE (set ALLOWED_USER_IDS!)'}`);

// dropPendingUpdates: buang update lama (mis. upload file yang nyangkut) saat start,
// biar Telegram gak kirim ulang update bermasalah tiap restart.
bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('🛑 Bot stopped.'))
  .catch(err => {
    console.error('❌ Bot launch failed:', err);
    process.exit(1);
  });

setTimeout(() => {
  console.log('🤖 Bot running... (kirim /start ke bot di Telegram)');
}, 2000);

process.once('SIGINT', () => { console.log('\n🛑 Stopping...'); try { bot.stop('SIGINT'); } catch {} process.exit(0); });
process.once('SIGTERM', () => { console.log('\n🛑 Stopping...'); try { bot.stop('SIGTERM'); } catch {} process.exit(0); });

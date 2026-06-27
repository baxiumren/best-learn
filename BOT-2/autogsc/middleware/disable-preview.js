/**
 * Auto-disable web page preview di semua ctx.reply / editMessageText.
 * Gak force parse_mode (biar /start message plain text tetep aman).
 */
module.exports = function disablePreviewMiddleware() {
  return async (ctx, next) => {
    const origReply = ctx.reply.bind(ctx);
    ctx.reply = (text, extra = {}) => {
      return origReply(text, { disable_web_page_preview: true, ...extra });
    };

    const origEdit = ctx.telegram.editMessageText.bind(ctx.telegram);
    ctx.telegram.editMessageText = (chatId, msgId, inlineId, text, extra = {}) => {
      return origEdit(chatId, msgId, inlineId, text, { disable_web_page_preview: true, ...extra });
    };

    return next();
  };
};

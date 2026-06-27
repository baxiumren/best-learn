/**
 * Simple ACL middleware: hanya allow user yang ada di ALLOWED list.
 */
module.exports = function aclMiddleware(allowedIds) {
  return async (ctx, next) => {
    if (allowedIds.length && !allowedIds.includes(ctx.from?.id)) {
      return ctx.reply(`❌ Access denied. Your ID: ${ctx.from?.id}`);
    }
    return next();
  };
};

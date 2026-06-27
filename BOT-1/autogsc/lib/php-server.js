const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

/**
 * Auto-start PHP built-in server kalau belum jalan.
 * Detached + windowsHide biar gak ganggu terminal bot.
 */
module.exports = function autoStartPhpServer() {
  const PHP_HOST = '127.0.0.1';
  const PHP_PORT = process.env.PHP_PORT || '3030';
  const PHP_ROOT = path.resolve(__dirname, '..', process.env.PHP_ROOT || '../');
  const checkUrl = `http://${PHP_HOST}:${PHP_PORT}/`;

  axios.get(checkUrl, { timeout: 1500 })
    .then(() => {
      console.log(`✅ PHP server already running at ${checkUrl}`);
    })
    .catch(() => {
      console.log(`🚀 Starting PHP server: ${PHP_HOST}:${PHP_PORT} (root: ${PHP_ROOT})`);
      const php = spawn('php', ['-S', `${PHP_HOST}:${PHP_PORT}`, '-t', PHP_ROOT], {
        cwd: PHP_ROOT,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      php.unref();
      php.on('error', (err) => {
        console.error('❌ Failed to start PHP server:', err.message);
        console.error('   Pastikan PHP terinstall & ada di PATH. Test: `php -v`');
      });
      setTimeout(() => {
        axios.get(checkUrl, { timeout: 2000 })
          .then(() => console.log(`✅ PHP server up at ${checkUrl}`))
          .catch(() => console.log(`⚠️ PHP server gagal start — cek manual: php -S ${PHP_HOST}:${PHP_PORT}`));
      }, 1500);
    });
};

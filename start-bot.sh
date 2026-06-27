#!/usr/bin/env bash
# ============================================================
# Jalankan 1 bot di dalam layar virtual (Xvfb).
# Usage:  bash start-bot.sh BOT-1
# Semua bot share display :99 → bisa di-VNC sekaligus (lihat vnc.sh).
# ============================================================
set -e

BOT="${1:?Usage: bash start-bot.sh BOT-1}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
DIR="$ROOT/$BOT/autogsc"

[ -d "$DIR" ] || { echo "❌ Folder tidak ada: $DIR"; exit 1; }

# Pastikan Xvfb display :99 jalan (sekali untuk semua bot)
export DISPLAY=:99
if ! xdpyinfo -display :99 >/dev/null 2>&1; then
  echo "==> Start Xvfb display :99"
  Xvfb :99 -screen 0 1366x768x24 >/tmp/xvfb.log 2>&1 &
  sleep 2
fi

cd "$DIR"
[ -d node_modules ] || { echo "==> npm install (pertama kali)"; npm install; }

echo "==> Start $BOT (DISPLAY=:99)"
npm start

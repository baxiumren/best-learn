#!/usr/bin/env bash
# ============================================================
# Buka akses VNC ke layar virtual (:99) buat LOGIN GOOGLE.
# Jalankan di VPS:  bash vnc.sh
# Lalu dari PC kamu (AMAN, lewat SSH tunnel):
#   ssh -L 5900:localhost:5900 user@103.37.124.146
#   → buka VNC viewer ke  localhost:5900
# ============================================================
set -e
export DISPLAY=:99

if ! xdpyinfo -display :99 >/dev/null 2>&1; then
  echo "❌ Xvfb :99 belum jalan. Start bot dulu: bash start-bot.sh BOT-1"
  exit 1
fi

echo "==> x11vnc di localhost:5900 (login lewat SSH tunnel, aman)"
echo "   Dari PC kamu jalanin:"
echo "     ssh -L 5900:localhost:5900 USER@103.37.124.146"
echo "   lalu VNC viewer ke: localhost:5900"
echo ""
# -localhost = cuma bisa diakses lewat tunnel (gak kebuka ke internet)
x11vnc -display :99 -localhost -rfbport 5900 -forever -shared -nopw

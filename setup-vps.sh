#!/usr/bin/env bash
# ============================================================
# Setup VPS Ubuntu 24.04 untuk AutoGSC bot.
# Jalankan SEKALI di VPS:  bash setup-vps.sh
# ============================================================
set -e

echo "==> [1/4] Update apt"
sudo apt update

echo "==> [2/4] Install Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "==> [3/4] Install Xvfb, VNC, PHP, dependencies Chrome"
sudo apt install -y xvfb x11vnc php-cli unzip wget gnupg ca-certificates \
  fonts-liberation libnss3 libatk-bridge2.0-0 libgtk-3-0 libasound2t64 \
  libgbm1 libxshmfence1 xdotool x11-utils

echo "==> [4/4] Install Google Chrome stable"
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list >/dev/null
sudo apt update
sudo apt install -y google-chrome-stable

echo ""
echo "============================================================"
echo "SELESAI."
echo "Chrome    : $(which google-chrome-stable)"
echo "Node      : $(node -v)"
echo "PHP       : $(php -v | head -1)"
echo ""
echo "Langkah berikutnya:"
echo "  1. Di tiap BOT-*/autogsc/.env → uncomment & set:"
echo "       CHROME_PATH=/usr/bin/google-chrome-stable"
echo "  2. Start bot:  bash start-bot.sh BOT-1"
echo "  3. Login Google (sekali):  bash vnc.sh   → connect VNC"
echo "============================================================"

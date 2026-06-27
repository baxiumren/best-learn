# Scrape Link Google Search via Console

Cara ambil semua link hasil pencarian Google (multi-page) langsung dari browser pakai DevTools Console.

## Persiapan

1. Buka Google, cari pakai operator `site:` (contoh: `site:global-business-recruiting.de`)
2. Tekan `F12` → buka tab **Console**
3. Kalau pertama kali paste kode, ketik manual: `allow pasting` → Enter

## Script Utama (Multi-Page, Auto-Copy)

Paste script ini di Console, Enter, lalu tunggu sampai selesai:

```js
(async () => {
  const all = new Set();
  for (let s = 0; s < 100; s += 10) {
    const res = await fetch(`/search?q=site:https://startupclubaalborg.dk/&start=${s}`, {credentials:'include'});
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('a h3').forEach(h => all.add(h.parentElement.href));
    await new Promise(r => setTimeout(r, 1500));
  }
  window.hasilLink = [...all].join('\n');
  console.log('=== HASIL ===\n' + window.hasilLink);
  console.log('Total:', all.size);
  try {
    await navigator.clipboard.writeText(window.hasilLink);
    console.log('✅ Ke-copy ke clipboard');
  } catch(e) {
    console.log('❌ Auto-copy gagal, jalankan: copy(hasilLink)');
  }
})();
```

## Kalau Auto-Copy Gagal

1. Klik halaman Google dulu (biar fokus pindah dari DevTools ke tab)
2. Balik ke Console, ketik:
   ```js
   copy(hasilLink)
   ```
3. Enter → paste ke Notepad/Excel

**Alternatif:** scroll ke output `=== HASIL ===` → blok manual → Ctrl+C.

## Custom

| Yang mau diubah | Bagian script |
|---|---|
| Domain target | Ganti `site:global-business-recruiting.de` |
| Jumlah halaman | Ganti `s < 100` (100 = 10 page, 200 = 20 page) |
| Delay antar-request | Ganti `1500` (ms). Naikin ke `2500-3000` kalau kena CAPTCHA |

## Script Pendek (1 Halaman Saja)

Kalau cuma butuh page yang lagi dibuka:

```js
copy([...document.querySelectorAll('a h3')].map(h=>h.parentElement.href).join('\n'))
```

## Catatan

- Google bisa kasih CAPTCHA kalau request terlalu cepat — solusinya: naikin delay atau selesaikan CAPTCHA manual lalu ulangi
- Script ini pakai cookie login lo (`credentials:'include'`), jadi hasilnya sama persis dengan yang lo lihat manual
- `copy()` adalah fungsi khusus DevTools Chrome, nggak ada di JS biasa

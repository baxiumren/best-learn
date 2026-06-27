const fs = require('fs');

/**
 * Parse domain_target.txt — each URL becomes its OWN property (max quota strategy).
 *
 * Input file format (1 URL per line):
 *   https://domain.com/
 *   https://domain.com/blog/
 *   https://domain.com/portfolio/elektroindustrie/
 *   https://otherdomain.com/page/
 *
 * Output:
 *   {
 *     "domain.com": {
 *       domain: "domain.com",
 *       totalUrls: 3,
 *       prefixes: ["/", "/blog/", "/portfolio/elektroindustrie/"],
 *       urlsByPrefix: { "/": [...], "/blog/": [...], ... }
 *     },
 *     "otherdomain.com": { ... }
 *   }
 */
function parseTargetsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const urls = raw.split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('http'));
  // Dedupe URL (jaga-jaga kalau domain_target.txt punya baris kembar)
  const uniqueUrls = [...new Set(urls)];
  return groupByDomain(uniqueUrls);
}

/**
 * Group URLs by hostname dengan HIERARCHICAL PREFIX OPTIMIZATION.
 *
 * Logic:
 * - Bangun tree dari path segments.
 * - Walk dari root → kalau subtree ≤ MAX_URLS_PER_PROPERTY (10), pakai prefix itu untuk 1 property.
 * - Kalau > 10, recurse ke child folder.
 * - Hasil: jumlah property SEMINIMAL mungkin, max 10 URL per property.
 *
 * Contoh:
 *   26 URL di /index.php/ → split jadi /2022/ (7), /2024/ (4), /2025/ (3), /2026/ (12 → split lagi)
 *   /2026/ → /2026/02/ (5), /2026/04/ (7)
 */
const MAX_URLS_PER_PROPERTY = 10;

function groupByDomain(urls) {
  const byDomain = {};

  // 1. Bucket per domain
  for (const url of urls) {
    let u;
    try { u = new URL(url); } catch { continue; }

    const domain = u.hostname;
    if (!byDomain[domain]) {
      byDomain[domain] = {
        domain,
        prefixes: [],
        urlsByPrefix: {},
        totalUrls: 0,
        _allUrls: [],
      };
    }
    byDomain[domain]._allUrls.push(url);
    byDomain[domain].totalUrls++;
  }

  // 2. Optimize prefix per domain
  for (const d of Object.values(byDomain)) {
    const optimized = optimizePrefixes(d._allUrls);
    for (const { prefix, urls: groupedUrls } of optimized) {
      d.prefixes.push(prefix);
      d.urlsByPrefix[prefix] = groupedUrls;
    }
    delete d._allUrls;
    // Sort prefixes by depth (deepest first — penting buat greedy matching)
    d.prefixes.sort((a, b) => b.length - a.length);
  }

  return byDomain;
}

/**
 * 1 URL = 1 PROPERTY STRATEGY (simple & clean):
 *
 * Rule: Setiap URL jadi 1 property sendiri pake FULL URL path-nya.
 * Quota: 10 URL/hari/property × N property = N × 10 = banyak.
 *
 * Contoh:
 *   /en/portfolios-e/                  → property /en/portfolios-e/
 *   /en/natalya-resnik-en/             → property /en/natalya-resnik-en/
 *   /en/category/photographer/page/3/  → property /en/category/photographer/page/3/
 *
 * Total: tiap URL = 1 property = 1 file GSC verifikasi.
 */
function optimizePrefixes(urls) {
  // Helper: get full URL path (with trailing slash)
  function fullUrlPath(url) {
    const u = new URL(url);
    const p = u.pathname;
    return p.endsWith('/') ? p : p + '/';
  }

  // Dedupe & assign 1 property per URL
  const seen = new Set();
  const results = [];

  for (const url of urls) {
    try {
      const prefix = fullUrlPath(url);
      if (seen.has(prefix)) continue;
      seen.add(prefix);
      results.push({ prefix, urls: [url] });
    } catch { /* skip invalid url */ }
  }

  // Sort by prefix length (deepest first untuk greedy matching)
  return results.sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * Convert URL prefix to folder path (mirror domain structure).
 *   "/"                              -> ""
 *   "/blog/"                         -> "blog"
 *   "/portfolio/elektroindustrie/"   -> "portfolio/elektroindustrie"
 */
function prefixToFolderPath(prefix) {
  if (prefix === '/') return '';
  return prefix.replace(/^\/|\/$/g, '');
}

/**
 * Parse sitemap.xml — extract all <loc> URLs and group by domain.
 *
 * Sitemap format:
 *   <urlset>
 *     <url><loc>https://domain.com/</loc></url>
 *     <url><loc>https://domain.com/blog/</loc></url>
 *   </urlset>
 */
function parseSitemapFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Sitemap not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  // Regex extract <loc>URL</loc>
  const matches = raw.match(/<loc>\s*([^<]+?)\s*<\/loc>/gi) || [];
  const urls = matches
    .map(m => m.replace(/<\/?loc>/gi, '').trim())
    .filter(s => s.startsWith('http'));
  // Dedupe URL (jaga-jaga kalau sitemap.xml punya entry kembar)
  const uniqueUrls = [...new Set(urls)];
  return groupByDomain(uniqueUrls);
}

module.exports = { parseTargetsFile, parseSitemapFile, groupByDomain, prefixToFolderPath };

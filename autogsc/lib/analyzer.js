const { XMLParser } = require('fast-xml-parser');
const axios = require('axios');

/**
 * Parse sitemap XML (supports sitemap index — auto expands).
 * Returns flat list of URLs.
 */
async function fetchAllUrls(xmlString, depth = 0) {
  if (depth > 3) return []; // anti-loop
  const parser = new XMLParser();
  const parsed = parser.parse(xmlString);

  // Sitemap index → recurse
  if (parsed.sitemapindex) {
    const subs = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    const all = [];
    for (const s of subs) {
      const loc = s.loc;
      try {
        const { data } = await axios.get(loc, { timeout: 15000 });
        const sub = await fetchAllUrls(data, depth + 1);
        all.push(...sub);
      } catch (e) {
        // skip failed sub-sitemap
      }
    }
    return all;
  }

  // Normal urlset
  if (parsed.urlset?.url) {
    const arr = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    return arr.map(u => (typeof u === 'string' ? u : u.loc)).filter(Boolean);
  }

  return [];
}

/**
 * Detect URL prefixes from list of URLs.
 * Returns parent folder per URL (1 level deep), plus root "/".
 */
function detectPrefixes(urls) {
  const prefixes = new Set(['/']);
  for (const url of urls) {
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 1) prefixes.add(`/${parts[0]}/`);
      // 2 level deep (optional, comment kalau gak mau)
      if (parts.length >= 2) prefixes.add(`/${parts[0]}/${parts[1]}/`);
    } catch (e) { /* skip invalid url */ }
  }
  // Sort longest first biar matching greedy
  return [...prefixes].sort((a, b) => b.length - a.length);
}

/**
 * Group URLs to their best-matching prefix.
 */
function groupUrlsByPrefix(urls, prefixes) {
  const grouped = {};
  for (const url of urls) {
    try {
      const path = new URL(url).pathname;
      for (const prefix of prefixes) {
        if (path.startsWith(prefix)) {
          if (!grouped[prefix]) grouped[prefix] = [];
          grouped[prefix].push(url);
          break;
        }
      }
    } catch (e) { /* skip */ }
  }
  return grouped;
}

/**
 * Main analyzer entry point.
 */
async function analyzeSitemap(xmlString) {
  const urls = await fetchAllUrls(xmlString);
  if (urls.length === 0) throw new Error('No URLs found in sitemap');

  const domain = new URL(urls[0]).hostname;
  const prefixes = detectPrefixes(urls);
  const urlsByPrefix = groupUrlsByPrefix(urls, prefixes);

  // Filter out prefixes that have 0 URLs (cleanup)
  const usedPrefixes = prefixes.filter(p => urlsByPrefix[p]?.length > 0);

  return {
    domain,
    prefixes: usedPrefixes,
    urlsByPrefix,
    totalUrls: urls.length,
  };
}

module.exports = { analyzeSitemap, fetchAllUrls, detectPrefixes, groupUrlsByPrefix };

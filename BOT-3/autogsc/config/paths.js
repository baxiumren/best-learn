const path = require('path');

/**
 * Resolve relative paths dari folder autogsc/.
 */
const root = path.resolve(__dirname, '..');
function resolveFromAutogsc(rel) {
  return path.resolve(root, rel);
}

module.exports = {
  ACFOLDER_RESULT_PATH:       resolveFromAutogsc(process.env.ACFOLDER_RESULT_PATH       || '../result/template_result'),
  ACFOLDER_TARGETS_FILE:      resolveFromAutogsc(process.env.ACFOLDER_TARGETS_FILE      || '../domain_target.txt'),
  ACFOLDER_SITEMAP_OUTPUT:    resolveFromAutogsc(process.env.ACFOLDER_SITEMAP_OUTPUT    || '../sitemapgenerator/sitemap.xml'),
  ACFOLDER_AMP_SOURCE_PATH:   resolveFromAutogsc(process.env.ACFOLDER_AMP_SOURCE_PATH   || '../result/amp_result/amp'),
  ACFOLDER_AMP_RESULT_PATH:   resolveFromAutogsc(process.env.ACFOLDER_AMP_RESULT_PATH   || '../result/amp_result/amp'),
  ACFOLDER_GENERATOR_URL:     process.env.ACFOLDER_GENERATOR_URL || '',
  ACFOLDER_SITEMAP_GEN_URL:   process.env.ACFOLDER_SITEMAP_GEN_URL || '',
  PUBLISH_BASE_URL:           process.env.PUBLISH_BASE_URL || 'https://kodokzuma.gaterlaluyakin.xyz/',
  PUBLISH_USERNAME:           process.env.PUBLISH_USERNAME || 'suparmanto',
  PUBLISH_PASSWORD:           process.env.PUBLISH_PASSWORD || 'supratbromantap2',
  ZIPS_DIR:                   resolveFromAutogsc('../result/_zips'),
};

<?php
/**
 * Sitemap Generator with Lastmod
 * Reads URLs from sitemap_domain.txt and generates a sitemap.xml file
 * with automatic lastmod (today's date in W3C format)
 */

// Configuration — pakai __DIR__ biar path absolute (gak depend on cwd PHP server)
$inputFile = __DIR__ . '/sitemap_domain.txt';
$outputFile = __DIR__ . '/sitemap.xml';
$changeFreq = 'daily';

// Lastmod date - use today's date in W3C format (YYYY-MM-DD)
// Pakai timezone Asia/Jakarta biar tanggal pas dengan lokal
date_default_timezone_set('Asia/Jakarta');
$lastMod = date('Y-m-d');

// Read URLs from input file
if (!file_exists($inputFile)) {
    die("Error: Input file '$inputFile' not found.\n");
}

$urls = file($inputFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

if (empty($urls)) {
    die("Error: No URLs found in '$inputFile'.\n");
}

// Start building XML
$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' . "\n";
$xml .= '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' . "\n";
$xml .= '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 ' . "\n";
$xml .= '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">' . "\n";
$xml .= "\n";

// Counter buat valid URLs
$count = 0;

// Add each URL
foreach ($urls as $url) {
    $url = trim($url);
    if (!empty($url)) {
        // Auto-fix http jadi https biar konsisten
        $url = preg_replace('/^http:\/\//i', 'https://', $url);

        // Escape XML special characters
        $url = htmlspecialchars($url, ENT_XML1, 'UTF-8');

        $xml .= '  <url>'
            . '<loc>' . $url . '</loc>'
            . '<lastmod>' . $lastMod . '</lastmod>'
            . '<changefreq>' . $changeFreq . '</changefreq>'
            . '</url>' . "\n";
        $count++;
    }
}

// Close XML
$xml .= "\n";
$xml .= '</urlset>' . "\n";

// Write to output file
if (file_put_contents($outputFile, $xml)) {
    echo "Success! Generated $outputFile with $count URLs.\n";
    echo "Lastmod set to: $lastMod\n";
    echo "Changefreq: $changeFreq\n";
} else {
    die("Error: Could not write to '$outputFile'.\n");
}
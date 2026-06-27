<?php

function submitSitemapToGoogle($sitemap_url)
{
    // This is a simplified example. In a real-world scenario, you'd use Google Search Console API.
    // Direct "ping" URLs are largely deprecated by Google.
    // You would typically submit your sitemap within Google Search Console.

    // For demonstration, a basic cURL request (not a true "ping" for indexing):
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://www.google.com/ping?sitemap=" . urlencode($sitemap_url));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);

    return $response;
}

// Example usage:
$your_sitemap_url = "https://newlam.ge/sitemap.xml";
$result = submitSitemapToGoogle($your_sitemap_url);

if ($result) {
    echo "Attempted to notify Google about sitemap: " . $your_sitemap_url;
} else {
    echo "Failed to notify Google.";
}

?>
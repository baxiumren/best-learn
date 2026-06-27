<?php
// =============================================
// AUTO FOLDER GENERATOR
// =============================================

// Configuration
$config = [
    'list_brand_file' => 'list_brand.txt',
    'list_image_file' => 'list_image.txt',
    'domain_target_file' => 'domain_target.txt',
    'template_file' => 'template.php',
    'template_amp_file' => 'template_amp.php',
    'result_folder' => 'result',

    // Default values for template variables
    'defaults' => [
        'FAVICON' => 'https://seo-bogo.pages.dev/turnamen.gif',
        'LOGO_BRAND' => 'https://seo-bogo.pages.dev/NNnaXNO.gif',
        'AMP_URL' => 'https://stabrog.nusaindahku.de/',
        'MONEY_SITE' => 'https://kutakbisa.lol/',
        'LOGO' => 'https://seo-bogo.pages.dev/NNnaXNO.gif',
        'AMP_IMAGE' => 'https://seo-bogo.pages.dev/f86ccec3-09dd-473e-9f37-84e8a3ae2754.png',
    ]
];

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['generate'])) {
    $result = generateFolders($config, $_POST);
    $message = $result['message'];
    $status = $result['status'];
}

/**
 * Main function to generate folders
 */
function generateFolders($config, $postData)
{
    $basePath = __DIR__ . '/' . $config['result_folder'];

    // Read input files
    $brands = readListFile($config['list_brand_file']);
    $images = readListFile($config['list_image_file']);
    $domains = readListFile($config['domain_target_file']);

    if (empty($brands)) {
        return ['status' => 'error', 'message' => 'list_brand.txt kosong atau tidak ditemukan'];
    }
    if (empty($images)) {
        return ['status' => 'error', 'message' => 'list_image.txt kosong atau tidak ditemukan'];
    }
    if (count($brands) !== count($images)) {
        return ['status' => 'error', 'message' => 'Jumlah brand (' . count($brands) . ') dan image (' . count($images) . ') harus sama'];
    }
    if (empty($domains)) {
        return ['status' => 'error', 'message' => 'domain_target.txt kosong atau tidak ditemukan'];
    }
    if (count($brands) !== count($domains)) {
        return ['status' => 'error', 'message' => 'Jumlah brand (' . count($brands) . ') dan domain (' . count($domains) . ') harus sama'];
    }

    // Read templates
    $templateContent = file_get_contents($config['template_file']);
    $templateAmpContent = file_get_contents($config['template_amp_file']);

    if (!$templateContent || !$templateAmpContent) {
        return ['status' => 'error', 'message' => 'File template tidak ditemukan'];
    }

    // Create result directories
    $templateResultPath = $basePath . '/template_result';
    $ampResultPath = $basePath . '/amp_result/amp';

    createDirectory($templateResultPath);
    createDirectory($ampResultPath);

    // Get config values from POST or defaults
    $vars = [
        'FAVICON' => $postData['favicon'] ?? $config['defaults']['FAVICON'],
        'LOGO_BRAND' => $postData['logo_brand'] ?? $config['defaults']['LOGO_BRAND'],
        'AMP_URL' => rtrim($postData['amp_url'] ?? $config['defaults']['AMP_URL'], '/') . '/',
        'MONEY_SITE' => $postData['money_site'] ?? $config['defaults']['MONEY_SITE'],
        'LOGO' => $postData['logo'] ?? $config['defaults']['LOGO'],
        'AMP_IMAGE' => $postData['amp_image'] ?? $config['defaults']['AMP_IMAGE'],
    ];

    $createdFiles = 0;

    // Generate template_result and amp_result folders
    // Each brand has its own canonical (from domain_target.txt) and image (from list_image.txt)
    foreach ($brands as $index => $brand) {
        $canonical = $domains[$index];
        $brandImage = $images[$index];
        $ampUrl = $vars['AMP_URL'] . $brand . '/';

        // === TEMPLATE RESULT ===
        $pathInfo = extractPathInfo($canonical);
        if (!empty($pathInfo['dir']) || !empty($pathInfo['file'])) {
            // Create folder path
            $folderPath = $templateResultPath;
            if (!empty($pathInfo['dir'])) {
                $folderPath .= '/' . $pathInfo['dir'];
            }
            createDirectory($folderPath);

            $content = $templateContent;
            $content = str_replace('{CANONICAL}', $canonical, $content);
            $content = str_replace('{AMP}', $ampUrl, $content);
            $content = str_replace('{BRAND}', $brand, $content);
            $content = str_replace('{LOGO_BRAND}', $vars['LOGO_BRAND'], $content);
            $content = str_replace('{TEMPLATE_IMAGE}', $brandImage, $content);
            $content = str_replace('{FAVICON}', $vars['FAVICON'], $content);

            // Save with correct filename (index.php for folders, or actual filename for file URLs)
            file_put_contents($folderPath . '/' . $pathInfo['file'], $content);
            $createdFiles++;
        }

        // === AMP RESULT ===
        $brandFolder = $ampResultPath . '/' . $brand;
        createDirectory($brandFolder);

        $content = $templateAmpContent;
        $content = str_replace('{BRAND}', $brand, $content);
        $content = str_replace('{FAVICON}', $vars['FAVICON'], $content);
        $content = str_replace('{CANONICAL}', $canonical, $content);
        $content = str_replace('{AMP_IMAGE}', $vars['AMP_IMAGE'], $content);
        $content = str_replace('{MONEY_SITE}', $vars['MONEY_SITE'], $content);
        $content = str_replace('{LOGO}', $vars['LOGO'], $content);

        file_put_contents($brandFolder . '/index.html', $content);
        $createdFiles++;
    }

    return [
        'status' => 'success',
        'message' => "Berhasil membuat {$createdFiles} file di folder '{$config['result_folder']}'"
    ];
}

/**
 * Read list file and return array of lines
 */
function readListFile($filename)
{
    if (!file_exists($filename)) {
        return [];
    }
    $content = file_get_contents($filename);
    $lines = explode("\n", $content);
    $lines = array_map('trim', $lines);
    $lines = array_filter($lines, function ($line) {
        return !empty($line);
    });
    return array_values($lines);
}

/**
 * Extract path info from URL
 * Returns: ['dir' => directory path, 'file' => filename]
 *
 * Examples:
 * https://domain.com/2018/07/ -> ['dir' => '2018/07', 'file' => 'index.php']
 * https://domain.com/promo-event/ -> ['dir' => 'promo-event', 'file' => 'index.php']
 * https://domain.com/category/home/menu.html -> ['dir' => 'category/home', 'file' => 'menu.html']
 * https://domain.com/category/aplikasi/155/apatekmi.html -> ['dir' => 'category/aplikasi/155', 'file' => 'apatekmi.html']
 */
function extractPathInfo($url)
{
    $parsed = parse_url($url);
    $path = isset($parsed['path']) ? $parsed['path'] : '';
    $path = trim($path, '/');

    // Check if URL ends with a file (has extension like .html, .php, .htm, etc.)
    $lastSegment = basename($path);
    if (preg_match('/\.[a-zA-Z0-9]+$/', $lastSegment)) {
        // It's a file URL
        $dir = dirname($path);
        $file = $lastSegment;
        // dirname returns '.' if path has no directory
        if ($dir === '.') {
            $dir = '';
        }
        return ['dir' => $dir, 'file' => $file];
    } else {
        // It's a folder URL, use index.php
        return ['dir' => $path, 'file' => 'index.php'];
    }
}

/**
 * Create directory recursively
 */
function createDirectory($path)
{
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto Folder Generator - Pembuat Folder Otomatis</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }

        h1 {
            color: #333;
        }

        .form-group {
            margin-bottom: 15px;
        }

        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }

        input[type="text"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        button {
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }

        button:hover {
            background: #45a049;
        }

        .message {
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }

        .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .info {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .info h3 {
            margin-top: 0;
        }

        .info code {
            background: #ddd;
            padding: 2px 6px;
            border-radius: 3px;
        }
    </style>
</head>

<body>
    <h1>Auto Folder Generator</h1>

    <div class="info">
        <h3>Panduan Penggunaan:</h3>
        <p><strong>Langkah 1:</strong> Buat file <code>list_brand.txt</code> berisi daftar nama brand (satu brand per
            baris)</p>
        <p><strong>Langkah 2:</strong> Buat file <code>list_image.txt</code> berisi daftar URL gambar untuk template
            (satu URL per baris, urutan sama dengan brand)</p>
        <p><strong>Langkah 3:</strong> Buat file <code>domain_target.txt</code> berisi daftar URL target (satu URL per
            baris)</p>
        <p><strong>Langkah 4:</strong> Isi konfigurasi di bawah ini sesuai kebutuhan</p>
        <p><strong>Langkah 5:</strong> Klik tombol "Buat Folder" untuk membuat folder</p>
        <hr style="margin: 15px 0; border: none; border-top: 1px solid #ccc;">
        <h4>Penting: Urutan file harus sama!</h4>
        <p>Baris ke-1 di list_brand.txt = Baris ke-1 di list_image.txt = Baris ke-1 di domain_target.txt</p>
        <pre style="background: #ddd; padding: 10px; border-radius: 4px; font-size: 12px;">
list_brand.txt:      list_image.txt:                    domain_target.txt:
SUKATOTO        →    https://img.com/sukatoto.jpg   →   https://domain.com/2018/07/
AKUBET          →    https://img.com/akubet.jpg     →   https://domain.com/2020/03/
PENIDABET       →    https://img.com/penidabet.jpg  →   https://domain.com/promo-event/</pre>
        <h4>Hasil yang akan dibuat:</h4>
        <p><strong>template_result/</strong></p>
        <ul style="margin: 5px 0;">
            <li><code>domain.com/2018/07/</code> → <code>2018/07/index.php</code></li>
            <li><code>domain.com/promo-event/</code> → <code>promo-event/index.php</code></li>
            <li><code>domain.com/category/home/menu.html</code> → <code>category/home/menu.html</code></li>
            <li><code>domain.com/path/to/file.php</code> → <code>path/to/file.php</code></li>
        </ul>
        <p><strong>amp_result/amp/</strong></p>
        <ul style="margin: 5px 0;">
            <li><code>SUKATOTO/index.html</code> → canonical sesuai domain_target.txt</li>
            <li><code>AKUBET/index.html</code> → canonical sesuai domain_target.txt</li>
        </ul>
    </div>

    <?php if (isset($message)): ?>
        <div class="message <?= $status ?>"><?= htmlspecialchars($message) ?></div>
    <?php endif; ?>

    <form method="POST">
        <h3>Konfigurasi:</h3>

        <div class="form-group">
            <label>Favicon URL:</label>
            <input type="text" name="favicon" value="<?= htmlspecialchars($config['defaults']['FAVICON']) ?>">
        </div>

        <div class="form-group">
            <label>Logo Brand URL (LP):</label>
            <input type="text" name="logo_brand" value="<?= htmlspecialchars($config['defaults']['LOGO_BRAND']) ?>">
        </div>

        <div class="form-group">
            <label>AMP URL (domain untuk halaman AMP):</label>
            <input type="text" name="amp_url" value="<?= htmlspecialchars($config['defaults']['AMP_URL']) ?>"
                placeholder="https://amppages.pages.dev/">
        </div>

        <div class="form-group">
            <label>Gambar AMP URL (untuk semua brand):</label>
            <input type="text" name="amp_image" value="<?= htmlspecialchars($config['defaults']['AMP_IMAGE']) ?>">
        </div>

        <div class="form-group">
            <label>Money Site URL:</label>
            <input type="text" name="money_site" value="<?= htmlspecialchars($config['defaults']['MONEY_SITE']) ?>">
        </div>

        <div class="form-group">
            <label>Logo URL (AMP):</label>
            <input type="text" name="logo" value="<?= htmlspecialchars($config['defaults']['LOGO']) ?>">
        </div>

        <button type="submit" name="generate">Buat Folder</button>
    </form>
</body>

</html>
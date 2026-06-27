<?php
// =============================================
// AUTO FOLDER GENERATOR
// =============================================

$config = [
    'list_brand_file'   => 'list_brand.txt',
    'list_image_file'   => 'list_image.txt',
    'domain_target_file'=> 'domain_target.txt',
    'template_file'     => 'template.php',
    'template_amp_file' => 'template_amp.php',
    'result_folder'     => 'result',
    'defaults' => [
        'FAVICON'    => 'https://seo-bogo.pages.dev/turnamen.gif',
        'LOGO_BRAND' => 'https://seo-bogo.pages.dev/NNnaXNO.gif',
        'AMP_URL'    => 'https://example.pages.dev/',
        'MONEY_SITE' => 'https://example.com/',
        'LOGO'       => 'https://seo-bogo.pages.dev/NNnaXNO.gif',
        'AMP_IMAGE'  => 'https://seo-bogo.pages.dev/f86ccec3-09dd-473e-9f37-84e8a3ae2754.png',
    ]
];

$message = '';
$status  = '';

// ── Save list files from textarea ──────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_lists'])) {
    file_put_contents($config['list_brand_file'],    trim($_POST['list_brand']));
    file_put_contents($config['list_image_file'],    trim($_POST['list_image']));
    file_put_contents($config['domain_target_file'], trim($_POST['domain_target']));
    $message = 'List berhasil disimpan!';
    $status  = 'success';
}

// ── Generate ────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['generate'])) {
    // Save lists first if provided
    if (!empty($_POST['list_brand']))    file_put_contents($config['list_brand_file'],    trim($_POST['list_brand']));
    if (!empty($_POST['list_image']))    file_put_contents($config['list_image_file'],    trim($_POST['list_image']));
    if (!empty($_POST['domain_target'])) file_put_contents($config['domain_target_file'], trim($_POST['domain_target']));

    $result  = generateFolders($config, $_POST);
    $message = $result['message'];
    $status  = $result['status'];
}

// ── Clear result ────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['clear_result'])) {
    $resultPath = __DIR__ . '/' . $config['result_folder'];
    if (is_dir($resultPath)) {
        deleteDir($resultPath);
        mkdir($resultPath, 0755, true);
    }
    $message = 'Folder result berhasil dikosongkan!';
    $status  = 'success';
}

// ── Download ZIP ────────────────────────────────────────
if (isset($_GET['action']) && $_GET['action'] === 'download_zip') {
    $resultPath = __DIR__ . '/' . $config['result_folder'];
    $zipFile    = sys_get_temp_dir() . '/auto-index-result.zip';
    if (class_exists('ZipArchive') && is_dir($resultPath)) {
        $zip = new ZipArchive();
        $zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        addDirToZip($zip, $resultPath, 'result');
        $zip->close();
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="result.zip"');
        header('Content-Length: ' . filesize($zipFile));
        readfile($zipFile);
        unlink($zipFile);
        exit;
    } else {
        die('ZipArchive tidak tersedia atau folder result kosong.');
    }
}

// ── Count helper ────────────────────────────────────────
function countLines($file) {
    if (!file_exists($file)) return 0;
    $lines = array_filter(array_map('trim', explode("\n", file_get_contents($file))));
    return count($lines);
}

// ── Delete dir recursively ──────────────────────────────
function deleteDir($path) {
    if (!is_dir($path)) return;
    foreach (scandir($path) as $item) {
        if ($item === '.' || $item === '..') continue;
        $full = $path . '/' . $item;
        is_dir($full) ? deleteDir($full) : unlink($full);
    }
    rmdir($path);
}

// ── Add dir to zip ──────────────────────────────────────
function addDirToZip($zip, $dir, $zipDir) {
    foreach (scandir($dir) as $item) {
        if ($item === '.' || $item === '..') continue;
        $full    = $dir . '/' . $item;
        $zipPath = $zipDir . '/' . $item;
        if (is_dir($full)) {
            $zip->addEmptyDir($zipPath);
            addDirToZip($zip, $full, $zipPath);
        } else {
            $zip->addFile($full, $zipPath);
        }
    }
}

// ── Generate folders ────────────────────────────────────
function generateFolders($config, $postData) {
    $basePath = __DIR__ . '/' . $config['result_folder'];
    $brands   = readListFile($config['list_brand_file']);
    $images   = readListFile($config['list_image_file']);
    $domains  = readListFile($config['domain_target_file']);

    if (empty($brands))                          return ['status'=>'error','message'=>'list_brand.txt kosong'];
    if (empty($images))                          return ['status'=>'error','message'=>'list_image.txt kosong'];
    if (count($brands) !== count($images))       return ['status'=>'error','message'=>'Jumlah brand ('.count($brands).') dan image ('.count($images).') harus sama'];
    if (empty($domains))                         return ['status'=>'error','message'=>'domain_target.txt kosong'];
    if (count($brands) !== count($domains))      return ['status'=>'error','message'=>'Jumlah brand ('.count($brands).') dan domain ('.count($domains).') harus sama'];

    $templateContent    = file_get_contents($config['template_file']);
    $templateAmpContent = file_get_contents($config['template_amp_file']);
    if (!$templateContent || !$templateAmpContent) return ['status'=>'error','message'=>'File template tidak ditemukan'];

    $templateResultPath = $basePath . '/template_result';
    $ampResultPath      = $basePath . '/amp_result/amp';
    createDirectory($templateResultPath);
    createDirectory($ampResultPath);

    $vars = [
        'FAVICON'    => $postData['favicon']    ?? $config['defaults']['FAVICON'],
        'LOGO_BRAND' => $postData['logo_brand'] ?? $config['defaults']['LOGO_BRAND'],
        'AMP_URL'    => rtrim($postData['amp_url'] ?? $config['defaults']['AMP_URL'], '/') . '/',
        'MONEY_SITE' => $postData['money_site'] ?? $config['defaults']['MONEY_SITE'],
        'LOGO'       => $postData['logo']       ?? $config['defaults']['LOGO'],
        'AMP_IMAGE'  => $postData['amp_image']  ?? $config['defaults']['AMP_IMAGE'],
    ];

    $createdFiles = 0;
    foreach ($brands as $index => $brand) {
        $canonical = $domains[$index];
        $brandImage = $images[$index];
        $ampUrl    = $vars['AMP_URL'] . $brand . '/';

        $pathInfo  = extractPathInfo($canonical);
        if (!empty($pathInfo['dir']) || !empty($pathInfo['file'])) {
            $folderPath = $templateResultPath;
            if (!empty($pathInfo['dir'])) $folderPath .= '/' . $pathInfo['dir'];
            createDirectory($folderPath);
            $content = str_replace(['{CANONICAL}','{AMP}','{BRAND}','{LOGO_BRAND}','{TEMPLATE_IMAGE}','{FAVICON}'],
                                   [$canonical, $ampUrl, $brand, $vars['LOGO_BRAND'], $brandImage, $vars['FAVICON']],
                                   $templateContent);
            file_put_contents($folderPath . '/' . $pathInfo['file'], $content);
            $createdFiles++;
        }

        $brandFolder = $ampResultPath . '/' . $brand;
        createDirectory($brandFolder);
        $content = str_replace(['{BRAND}','{FAVICON}','{CANONICAL}','{AMP_IMAGE}','{MONEY_SITE}','{LOGO}'],
                               [$brand, $vars['FAVICON'], $canonical, $vars['AMP_IMAGE'], $vars['MONEY_SITE'], $vars['LOGO']],
                               $templateAmpContent);
        file_put_contents($brandFolder . '/index.html', $content);
        $createdFiles++;
    }

    return ['status'=>'success','message'=>"✅ Berhasil membuat {$createdFiles} file dari ".count($brands)." brand!"];
}

function readListFile($filename) {
    if (!file_exists($filename)) return [];
    return array_values(array_filter(array_map('trim', explode("\n", file_get_contents($filename)))));
}

function extractPathInfo($url) {
    $parsed = parse_url($url);
    $path   = trim(isset($parsed['path']) ? $parsed['path'] : '', '/');
    $last   = basename($path);
    if (preg_match('/\.[a-zA-Z0-9]+$/', $last)) {
        $dir = dirname($path);
        return ['dir' => ($dir === '.' ? '' : $dir), 'file' => $last];
    }
    return ['dir' => $path, 'file' => 'index.php'];
}

function createDirectory($path) {
    if (!is_dir($path)) mkdir($path, 0755, true);
}

// ── Load current list files ──────────────────────────────
$currentBrand  = file_exists($config['list_brand_file'])    ? file_get_contents($config['list_brand_file'])    : '';
$currentImage  = file_exists($config['list_image_file'])    ? file_get_contents($config['list_image_file'])    : '';
$currentDomain = file_exists($config['domain_target_file']) ? file_get_contents($config['domain_target_file']) : '';

$countBrand  = countLines($config['list_brand_file']);
$countImage  = countLines($config['list_image_file']);
$countDomain = countLines($config['domain_target_file']);

$resultExists = is_dir(__DIR__ . '/' . $config['result_folder']) &&
                count(array_diff(scandir(__DIR__ . '/' . $config['result_folder']), ['.','..','.gitkeep'])) > 0;
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AUTO-INDEX Generator</title>
    <style>
        :root {
            --bg:      #0a0f1e;
            --bg2:     #0f1628;
            --card:    rgba(255,255,255,0.04);
            --border:  rgba(255,255,255,0.08);
            --blue:    #3b82f6;
            --blue2:   #1d4ed8;
            --gold:    #f59e0b;
            --green:   #10b981;
            --red:     #ef4444;
            --text:    #e2e8f0;
            --muted:   #64748b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 24px 16px 60px;
        }
        .wrap { max-width: 900px; margin: 0 auto; }

        /* Header */
        .header {
            text-align: center;
            margin-bottom: 32px;
            padding: 32px;
            background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(29,78,216,0.1));
            border: 1px solid rgba(59,130,246,0.25);
            border-radius: 16px;
        }
        .header h1 {
            font-size: 2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #60a5fa, #f59e0b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 2px;
        }
        .header p { color: var(--muted); margin-top: 6px; font-size: 14px; }

        /* Stats bar */
        .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            text-align: center;
        }
        .stat-card .num { font-size: 2rem; font-weight: 800; color: var(--blue); }
        .stat-card .lbl { font-size: 11px; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .stat-card.ok .num { color: var(--green); }
        .stat-card.warn .num { color: var(--gold); }

        /* Cards */
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
        }
        .card-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--blue);
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card-title::before {
            content: '';
            display: block;
            width: 3px;
            height: 14px;
            background: var(--blue);
            border-radius: 2px;
        }

        /* List columns */
        .list-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
        }
        .list-col label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: var(--muted);
            margin-bottom: 6px;
        }
        .list-col label span {
            float: right;
            color: var(--blue);
            font-weight: 700;
        }
        textarea {
            width: 100%;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            resize: vertical;
            min-height: 160px;
            transition: border-color .2s;
        }
        textarea:focus { outline: none; border-color: var(--blue); }

        /* Config grid */
        .config-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }
        .form-group label {
            display: block;
            font-size: 12px;
            color: var(--muted);
            margin-bottom: 5px;
            font-weight: 600;
        }
        .form-group input[type="text"] {
            width: 100%;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 13px;
            padding: 10px 12px;
            transition: border-color .2s;
        }
        .form-group input:focus { outline: none; border-color: var(--blue); }

        /* Buttons */
        .btn-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 20px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 11px 20px;
            border: none;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            transition: all .2s;
        }
        .btn:hover { transform: translateY(-1px); opacity: .9; }
        .btn:active { transform: scale(.97); }
        .btn-primary { background: linear-gradient(135deg, var(--blue), var(--blue2)); color: #fff; }
        .btn-gold    { background: linear-gradient(135deg, var(--gold), #d97706); color: #000; }
        .btn-green   { background: linear-gradient(135deg, var(--green), #059669); color: #fff; }
        .btn-red     { background: linear-gradient(135deg, var(--red), #dc2626); color: #fff; }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
        .btn-lg { padding: 14px 32px; font-size: 15px; }

        /* Message */
        .msg {
            padding: 14px 18px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-weight: 600;
            font-size: 14px;
        }
        .msg.success { background: rgba(16,185,129,.15); border: 1px solid rgba(16,185,129,.3); color: #34d399; }
        .msg.error   { background: rgba(239,68,68,.15);  border: 1px solid rgba(239,68,68,.3);  color: #f87171; }

        /* Guide */
        .guide {
            background: rgba(59,130,246,.06);
            border: 1px solid rgba(59,130,246,.15);
            border-radius: 10px;
            padding: 16px;
            font-size: 13px;
            color: var(--muted);
            line-height: 1.8;
        }
        .guide code {
            background: rgba(255,255,255,.08);
            padding: 1px 6px;
            border-radius: 4px;
            color: #93c5fd;
            font-size: 12px;
        }
        .guide strong { color: var(--text); }

        /* Result info */
        .result-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
        }
        .badge-green { background: rgba(16,185,129,.15); color: #34d399; border: 1px solid rgba(16,185,129,.3); }
        .badge-muted { background: rgba(255,255,255,.05); color: var(--muted); border: 1px solid var(--border); }

        @media (max-width: 640px) {
            .list-grid   { grid-template-columns: 1fr; }
            .config-grid { grid-template-columns: 1fr; }
            .stats       { grid-template-columns: repeat(3,1fr); }
            .stat-card .num { font-size: 1.4rem; }
        }
    </style>
</head>
<body>
<div class="wrap">

    <!-- Header -->
    <div class="header">
        <h1>⚡ AUTO-INDEX GENERATOR</h1>
        <p>Generate template & AMP folder otomatis dari brand list</p>
    </div>

    <!-- Message -->
    <?php if ($message): ?>
    <div class="msg <?= $status ?>"><?= htmlspecialchars($message) ?></div>
    <?php endif; ?>

    <!-- Stats -->
    <div class="stats">
        <div class="stat-card <?= $countBrand > 0 ? 'ok' : '' ?>">
            <div class="num"><?= $countBrand ?></div>
            <div class="lbl">Brand</div>
        </div>
        <div class="stat-card <?= $countImage > 0 ? 'ok' : '' ?>">
            <div class="num"><?= $countImage ?></div>
            <div class="lbl">Image</div>
        </div>
        <div class="stat-card <?= $countDomain > 0 ? 'ok' : '' ?>">
            <div class="num"><?= $countDomain ?></div>
            <div class="lbl">Domain</div>
        </div>
    </div>

    <form method="POST">

        <!-- List Input -->
        <div class="card">
            <div class="card-title">📋 Input Data</div>
            <div class="guide" style="margin-bottom:16px;">
                <strong>Aturan:</strong> Urutan baris harus sama di ketiga kolom.
                Baris ke-1 brand = baris ke-1 image = baris ke-1 domain target. <br>
                Format domain: <code>https://domain.com/path/</code> atau <code>https://domain.com/path/file.html</code>
            </div>
            <div class="list-grid">
                <div class="list-col">
                    <label>list_brand.txt <span><?= $countBrand ?> baris</span></label>
                    <textarea name="list_brand" placeholder="BRANDNAME1&#10;BRANDNAME2&#10;BRANDNAME3"><?= htmlspecialchars($currentBrand) ?></textarea>
                </div>
                <div class="list-col">
                    <label>list_image.txt <span><?= $countImage ?> baris</span></label>
                    <textarea name="list_image" placeholder="https://img.com/brand1.jpg&#10;https://img.com/brand2.jpg"><?= htmlspecialchars($currentImage) ?></textarea>
                </div>
                <div class="list-col">
                    <label>domain_target.txt <span><?= $countDomain ?> baris</span></label>
                    <textarea name="domain_target" placeholder="https://domain.com/2024/01/&#10;https://domain2.com/promo/"><?= htmlspecialchars($currentDomain) ?></textarea>
                </div>
            </div>
            <div class="btn-row">
                <button type="submit" name="save_lists" class="btn btn-outline">💾 Simpan List</button>
            </div>
        </div>

        <!-- Config -->
        <div class="card">
            <div class="card-title">⚙️ Konfigurasi</div>
            <div class="config-grid">
                <div class="form-group">
                    <label>Favicon URL</label>
                    <input type="text" name="favicon" value="<?= htmlspecialchars($config['defaults']['FAVICON']) ?>">
                </div>
                <div class="form-group">
                    <label>Logo Brand URL (LP)</label>
                    <input type="text" name="logo_brand" value="<?= htmlspecialchars($config['defaults']['LOGO_BRAND']) ?>">
                </div>
                <div class="form-group">
                    <label>AMP URL</label>
                    <input type="text" name="amp_url" value="<?= htmlspecialchars($config['defaults']['AMP_URL']) ?>" placeholder="https://amppages.pages.dev/">
                </div>
                <div class="form-group">
                    <label>Gambar AMP URL</label>
                    <input type="text" name="amp_image" value="<?= htmlspecialchars($config['defaults']['AMP_IMAGE']) ?>">
                </div>
                <div class="form-group">
                    <label>Money Site URL</label>
                    <input type="text" name="money_site" value="<?= htmlspecialchars($config['defaults']['MONEY_SITE']) ?>">
                </div>
                <div class="form-group">
                    <label>Logo URL (AMP)</label>
                    <input type="text" name="logo" value="<?= htmlspecialchars($config['defaults']['LOGO']) ?>">
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="card">
            <div class="card-title">🚀 Aksi</div>
            <div class="result-info">
                <div>
                    <?php if ($resultExists): ?>
                    <span class="badge badge-green">✓ Result folder ada</span>
                    <?php else: ?>
                    <span class="badge badge-muted">— Belum ada result</span>
                    <?php endif; ?>
                </div>
                <div class="btn-row" style="margin-top:0;">
                    <?php if ($resultExists): ?>
                    <a href="?action=download_zip" class="btn btn-green">📦 Download ZIP</a>
                    <button type="submit" name="clear_result" class="btn btn-red"
                        onclick="return confirm('Yakin mau hapus semua hasil generate?')">🗑️ Clear Result</button>
                    <?php endif; ?>
                </div>
            </div>
            <div class="btn-row" style="margin-top:20px;">
                <button type="submit" name="generate" class="btn btn-primary btn-lg">⚡ Generate Sekarang</button>
            </div>
        </div>

    </form>

</div>
</body>
</html>

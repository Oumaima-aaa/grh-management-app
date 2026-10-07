<?php

/**
 * OneDrive often makes is_writable() fail on bootstrap/cache.
 * Run: php build_package_manifest.php
 */

$base = __DIR__;
$manifestPath = $base.'/bootstrap/cache/packages.php';
$installed = json_decode(file_get_contents($base.'/vendor/composer/installed.json'), true);
$packages = $installed['packages'] ?? $installed;

$ignore = json_decode(file_get_contents($base.'/composer.json'), true)['extra']['laravel']['dont-discover'] ?? [];
$ignoreAll = in_array('*', $ignore, true);

$manifest = [];
foreach ($packages as $package) {
    $name = $package['name'];
    $config = $package['extra']['laravel'] ?? [];
    $ignore = array_merge($ignore, $config['dont-discover'] ?? []);
    if ($ignoreAll || in_array($name, $ignore, true)) {
        continue;
    }
    if ($config === []) {
        continue;
    }
    $manifest[$name] = $config;
}

$content = '<?php return '.var_export($manifest, true).';';
file_put_contents($manifestPath, $content);
echo "Wrote {$manifestPath}\n";

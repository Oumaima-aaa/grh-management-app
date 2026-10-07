# Corrige bootstrap/cache sous OneDrive (lecture seule / non inscriptible).
# Usage: powershell -ExecutionPolicy Bypass -File fix_bootstrap_cache.ps1

$ErrorActionPreference = "Stop"
$backendRoot = $PSScriptRoot
$cachePath = Join-Path $backendRoot "bootstrap\cache"
$tempCache = Join-Path $env:TEMP "grh-bootstrap-cache"

if (-not (Test-Path $tempCache)) {
    New-Item -ItemType Directory -Path $tempCache -Force | Out-Null
}

if (Test-Path $cachePath) {
    $item = Get-Item $cachePath -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        cmd /c rmdir "$cachePath" 2>$null
    } elseif ($item.PSIsContainer) {
        Remove-Item $cachePath -Recurse -Force
    }
}

cmd /c mklink /J "$cachePath" "$tempCache"
Write-Host "OK: bootstrap/cache -> $tempCache" -ForegroundColor Green

Set-Location $backendRoot
php artisan config:clear
php artisan route:clear
php artisan package:discover
Write-Host "Relancez: php artisan serve --host=127.0.0.1 --port=8000" -ForegroundColor Cyan

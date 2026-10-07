<?php

/**
 * Initialise les comptes demo (equivalent POST /api/seed).
 * Usage: php run_seed.php
 */

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$request = Illuminate\Http\Request::create('/api/seed', 'POST', [], [], [], [
    'HTTP_ACCEPT' => 'application/json',
]);
$response = $app->handle($request);
echo $response->getContent(), PHP_EOL;

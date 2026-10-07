<?php

/**
 * Reactive les comptes de demo (active = true).
 * Usage: php fix_accounts_active.php
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

$emails = ['admin@grh.local', 'rh@grh.local', 'employe@grh.local'];

foreach ($emails as $email) {
    $user = User::where('email', $email)->first();
    if (!$user) {
        echo "Absent: {$email}\n";
        continue;
    }
    $user->active = true;
    $user->api_token = null;
    $user->save();
    echo "Reactive (token efface): {$email}\n";
}

echo "Termine.\n";

<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;

foreach (['admin@grh.local', 'rh@grh.local', 'employe@grh.local'] as $email) {
    $u = User::where('email', $email)->first();
    if (!$u) {
        echo "{$email}: ABSENT\n";
        continue;
    }
    $len = $u->api_token ? strlen($u->api_token) : 0;
    echo "{$email}: active=" . ($u->active ? '1' : '0') . " token_len={$len}\n";
}

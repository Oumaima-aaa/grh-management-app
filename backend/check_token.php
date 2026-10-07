<?php

require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$email = $argv[1] ?? 'admin@grh.local';
$user = App\Models\User::where('email', $email)->first();

if (!$user) {
    echo "User not found: {$email}\n";
    exit(1);
}

echo "email: {$user->email}\n";
echo "active: " . ($user->isLoginAllowed() ? 'yes' : 'no') . "\n";
echo "api_token: " . ($user->api_token ? strlen($user->api_token) . ' chars' : 'NULL') . "\n";

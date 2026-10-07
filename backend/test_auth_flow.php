<?php

require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function callApi(string $method, string $path, ?string $token = null, ?array $body = null): void {
    $req = Illuminate\Http\Request::create(
        $path,
        $method,
        server: ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'],
        content: $body ? json_encode($body) : null
    );
    if ($token) {
        $req->headers->set('Authorization', 'Bearer ' . $token);
    }
    $res = $app->handle($req);
    echo "{$method} {$path} => {$res->getStatusCode()} " . substr($res->getContent(), 0, 120) . "\n";
}

global $app;

callApi('GET', '/api/me', 'invalid-token-xyz');
$login = $app->handle(Illuminate\Http\Request::create(
    '/api/login',
    'POST',
    server: ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'],
    content: json_encode(['email' => 'admin@grh.local', 'password' => 'Admin123!'])
));
$data = json_decode($login->getContent(), true);
$token = $data['token'] ?? '';
echo "login status: {$login->getStatusCode()} token_len=" . strlen($token) . "\n";
callApi('GET', '/api/me', $token);
callApi('GET', '/api/admin/dashboard', $token);

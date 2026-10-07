<?php

use App\Http\Requests\LoginRequest;
use App\Models\EmployeeProfile;
use App\Models\Permission;
use App\Models\Role;
use App\Services\PermissionResolver;
use App\Models\LeaveRequest;
use App\Models\PasswordResetToken;
use App\Models\RoleProfile;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\CareerPlan;
use App\Models\PerformanceEvaluation;
use App\Models\HrInformationRequest;
use App\Models\RecruitmentCandidate;
use App\Models\TrainingSession;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

$allowedPermissionsByRole = [
    'admin' => ['manage_users', 'view_dashboard', 'view_reports'],
    'rh' => [
        'manage_employees',
        'manage_hr_info',
        'manage_leave',
        'manage_training',
        'manage_evaluations',
        'manage_recruitment',
        'manage_careers',
        'view_dashboard',
    ],
    'employe' => [
        'view_own_profile',
        'view_own_leaves',
        'view_own_trainings',
        'view_own_evaluations',
        'view_own_career',
        'view_own_hr_info',
    ],
];

$allowedRolePermissionSlugs = function (?string $role) use ($allowedPermissionsByRole) {
    if (!$role) {
        return PermissionResolver::allSlugs();
    }

    if (array_key_exists($role, $allowedPermissionsByRole) && !empty($allowedPermissionsByRole[$role])) {
        return $allowedPermissionsByRole[$role];
    }

    if ($role === 'employe') {
        return PermissionResolver::EMPLOYEE_SLUGS;
    }

    return PermissionResolver::allSlugs();
};

Route::post('/accounts/reactivate-demo', function () {
    $emails = ['admin@grh.local', 'rh@grh.local', 'employe@grh.local'];
    $fixed = [];
    foreach ($emails as $email) {
        $user = User::where('email', $email)->first();
        if ($user) {
            $user->active = true;
            $user->save();
            $fixed[] = $email;
        }
    }
    return response()->json([
        'message' => 'Comptes de demonstration reactives.',
        'emails' => $fixed,
    ]);
});

Route::post('/seed', function () {
    (new \Database\Seeders\GrhSeeder)->run();

    return response()->json([
        'message' => 'Seed termine',
        'accounts' => \Database\Seeders\GrhSeeder::DEMO_ACCOUNTS,
    ]);
});

/**
 * Laravel/Symfony should parse JSON automatically when Content-Type is application/json,
 * but in some Windows setups it can arrive empty. We fallback to decoding raw content.
 */
$readInput = function (Request $request): array {
    $input = $request->json()->all();
    if (!empty($input)) {
        return $input;
    }

    $raw = (string) $request->getContent();
    if ($raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }

    $post = $request->request->all();
    if (!empty($post)) {
        return $post;
    }

    return $request->all();
};

Route::post('/login', function (LoginRequest $request) {
    $payload = $request->validated();
    $throttleKey = 'login:' . sha1(strtolower($payload['email']) . '|' . $request->ip());

    if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
        $seconds = RateLimiter::availableIn($throttleKey);

        return response()->json([
            'error' => "Trop de tentatives. Reessayez dans {$seconds} seconde(s).",
        ], 429);
    }

    try {
        $user = User::where('email', $payload['email'])->first();
        if (!$user || !Hash::check($payload['password'], $user->password)) {
            RateLimiter::hit($throttleKey, 60);

            return response()->json(['error' => 'Identifiants invalides'], 401);
        }
        if (!$user->isLoginAllowed()) {
            return response()->json(['error' => 'Compte desactive. Contactez l administrateur.'], 403);
        }

        RateLimiter::clear($throttleKey);

        $token = hash('sha256', Str::random(80));
        $user->api_token = $token;
        $user->save();

        AuditLog::create([
            'actor_email' => $user->email,
            'action' => 'login',
            'target' => $user->email,
            'meta' => ['role' => $user->role],
            'created_at' => now(),
        ]);

        PermissionResolver::bootstrapAfterAuth($user);
        $user->refresh();

        return response()->json([
            'token' => $token,
            'user' => PermissionResolver::userPayload($user),
            'role' => $user->role,
            'permissions' => PermissionResolver::effectiveSlugs($user),
        ]);
    } catch (ValidationException $e) {
        throw $e;
    } catch (\Throwable $e) {
        Log::error('Echec login', ['exception' => $e->getMessage()]);
        $msg = strtolower($e->getMessage());
        $hint = 'Erreur serveur pendant la connexion.';
        if (str_contains($msg, 'could not find driver') || str_contains($msg, 'pdo mysql')) {
            $hint = 'Extension PHP pdo_mysql introuvable. Activez extension=pdo_mysql dans php.ini.';
        } elseif (
            str_contains($msg, 'connection refused')
            || str_contains($msg, 'access denied')
            || str_contains($msg, 'unknown database')
            || str_contains($msg, 'sqlstate')
        ) {
            $hint = 'MySQL inaccessible. Verifiez DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD dans backend/.env puis lancez: php artisan migrate';
        }

        return response()->json(['error' => $hint], 500);
    }
});

Route::post('/forgot-password', function (Request $request) use ($readInput) {
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'email' => ['required', 'email'],
    ])->validate();

    $email = strtolower($payload['email']);
    $user = User::where('email', $email)->first();

    if (!$user) {
        return response()->json([
            'message' => 'Si ce compte existe, un email de reinitialisation a ete envoye.',
        ]);
    }

    PasswordResetToken::where('email', $email)->delete();

    $plainToken = Str::random(64);
    PasswordResetToken::create([
        'email' => $email,
        'token' => hash('sha256', $plainToken),
        'created_at' => now(),
    ]);

    $frontendUrl = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');
    $resetUrl = $frontendUrl . '/reset-password?email=' . urlencode($email) . '&token=' . urlencode($plainToken);

    if (empty(env('MAIL_USERNAME')) || empty(env('MAIL_PASSWORD'))) {
        return response()->json([
            'error' => 'Configuration Gmail incomplete (MAIL_USERNAME / MAIL_PASSWORD).',
        ], 422);
    }

    try {
        Mail::raw(
            "Bonjour {$user->name},\n\nCliquez sur ce lien pour reinitialiser votre mot de passe:\n{$resetUrl}\n\nCe lien expire dans 60 minutes.",
            function ($message) use ($email) {
                $message->to($email)->subject('Reinitialisation de mot de passe GRH');
            }
        );
    } catch (\Throwable $e) {
        Log::error('Echec envoi email de reinitialisation', ['exception' => $e->getMessage()]);
        return response()->json([
            'error' => 'Echec envoi email. Verifiez la configuration Gmail (SMTP, App Password).',
        ], 500);
    }

    return response()->json([
        'message' => 'Si ce compte existe, un email de reinitialisation a ete envoye.',
    ]);
});

Route::post('/reset-password', function (Request $request) use ($readInput) {
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'email' => ['required', 'email'],
        'token' => ['required', 'string'],
        'password' => ['required', 'string', 'min:8', 'confirmed'],
    ])->validate();

    $email = strtolower($payload['email']);
    $resetToken = PasswordResetToken::where('email', $email)->first();

    if (!$resetToken) {
        return response()->json(['error' => 'Lien invalide ou expire'], 422);
    }

    $isExpired = Carbon::parse($resetToken->created_at)->addMinutes(60)->isPast();
    if ($isExpired || !hash_equals($resetToken->token, hash('sha256', $payload['token']))) {
        return response()->json(['error' => 'Lien invalide ou expire'], 422);
    }

    $user = User::where('email', $email)->first();
    if (!$user) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }

    $user->password = $payload['password'];
    $user->api_token = null;
    $user->save();

    $resetToken->delete();

    return response()->json(['message' => 'Mot de passe mis a jour avec succes']);
});

$profileForUser = function (User $user): EmployeeProfile {
    return EmployeeProfile::firstOrCreate(
        ['user_email' => strtolower($user->email)],
        [
            'matricule' => 'EMP-' . strtoupper(substr(preg_replace('/[^a-z0-9]/', '', $user->email), 0, 6)),
            'poste' => 'Employe',
            'service' => 'Operations',
            'salaire' => null,
            'hire_date' => now()->subYear()->format('Y-m-d'),
        ]
    );
};

$auth = function (Request $request): User {
    $header = $request->header('Authorization', '');
    if (!str_starts_with($header, 'Bearer ')) {
        throw new HttpResponseException(response()->json(['error' => 'Token manquant'], 401));
    }
    $token = trim(substr($header, 7));
    if ($token === '') {
        throw new HttpResponseException(response()->json(['error' => 'Token manquant'], 401));
    }
    $user = User::where('api_token', $token)->first();
    if (!$user) {
        throw new HttpResponseException(response()->json(['error' => 'Token invalide'], 401));
    }
    if (!$user->isLoginAllowed()) {
        throw new HttpResponseException(response()->json(['error' => 'Compte desactive. Contactez l administrateur.'], 403));
    }
    return $user;
};

$ensurePermission = function (User $user, string ...$permissions): void {
    if (empty($permissions)) {
        return;
    }
    if (!PermissionResolver::hasAny($user, $permissions)) {
        throw new HttpResponseException(response()->json([
            'error' => 'Permission refusee',
            'required' => array_values($permissions),
        ], 403));
    }
};

$adminOnly = function (Request $request, string ...$permissions) use ($auth, $ensurePermission): User {
    $user = $auth($request);
    if ($user->role !== 'admin') {
        throw new HttpResponseException(response()->json(['error' => 'Acces refuse'], 403));
    }
    $ensurePermission($user, ...$permissions);
    return $user;
};

$logAdminAction = function (User $admin, string $action, string $target, array $meta = []): void {
    AuditLog::create([
        'actor_email' => $admin->email,
        'action' => $action,
        'target' => $target,
        'meta' => $meta,
        'created_at' => now(),
    ]);
};

$findUserForAdminAction = function (string $identifier): ?User {
    $normalized = strtolower(trim($identifier));

    $byPrimary = User::find($identifier);
    if ($byPrimary) {
        return $byPrimary;
    }

    return User::where('email', $normalized)->first();
};

$hrOnly = function (Request $request, string ...$permissions) use ($auth, $ensurePermission): User {
    $user = $auth($request);
    if ($user->role !== 'rh') {
        throw new HttpResponseException(response()->json(['error' => 'Action reservee au responsable RH.'], 403));
    }
    $ensurePermission($user, ...$permissions);
    return $user;
};

$hrOrAdminRead = function (Request $request, string ...$permissions) use ($auth, $ensurePermission): User {
    $user = $auth($request);
    if (!in_array($user->role, ['rh', 'admin'], true)) {
        throw new HttpResponseException(response()->json(['error' => 'Acces refuse'], 403));
    }
    $ensurePermission($user, ...$permissions);
    return $user;
};

$employeeOnly = function (Request $request, string ...$permissions) use ($auth, $ensurePermission): User {
    $user = $auth($request);
    if ($user->role !== 'employe') {
        throw new HttpResponseException(response()->json(['error' => 'Acces reserve aux employes.'], 403));
    }
    $ensurePermission($user, ...$permissions);
    return $user;
};

$actorCanManageTargetPermissions = function (Request $request, User $target) use ($auth): User {
    $actor = $auth($request);
    if ($actor->role === 'admin' && PermissionResolver::has($actor, 'manage_users')) {
        return $actor;
    }
    if (
        in_array($actor->role, ['admin', 'rh'], true)
        && PermissionResolver::has($actor, 'manage_employees')
        && $target->role === 'employe'
    ) {
        return $actor;
    }
    throw new HttpResponseException(response()->json(['error' => 'Acces refuse'], 403));
};

$actorCanReadPermissionsCatalog = function (Request $request) use ($auth): User {
    $actor = $auth($request);
    if (PermissionResolver::has($actor, 'manage_users') || PermissionResolver::has($actor, 'manage_employees')) {
        return $actor;
    }
    throw new HttpResponseException(response()->json(['error' => 'Acces refuse'], 403));
};

Route::get('/me', function (Request $request) use ($auth) {
    $user = $auth($request);
    PermissionResolver::bootstrapAfterAuth($user);
    $user->refresh();
    return response()->json([
        'user' => PermissionResolver::userPayload($user),
        'role' => $user->role,
        'permissions' => PermissionResolver::effectiveSlugs($user),
    ]);
});

Route::post('/logout', function (Request $request) use ($auth) {
    $user = $auth($request);
    $user->api_token = null;
    $user->save();

    return response()->json(['message' => 'Deconnexion reussie']);
});

Route::get('/permissions', function (Request $request) use ($actorCanReadPermissionsCatalog) {
    $actorCanReadPermissionsCatalog($request);
    return response()->json([
        'permissions' => Permission::query()->orderBy('slug')->get(['id', 'name', 'slug']),
    ]);
});

Route::get('/admin/users/{id}/permissions', function (Request $request, string $id) use ($actorCanManageTargetPermissions, $findUserForAdminAction) {
    $target = $findUserForAdminAction($id);
    if (!$target) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }
    $actorCanManageTargetPermissions($request, $target);
    if (!$target) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }
    $target->load('permissions:id,slug,name');

    return response()->json([
        'user' => ['id' => $target->id, 'email' => $target->email, 'role' => $target->role],
        'permissions' => $target->permissions->pluck('slug'),
    ]);
});

Route::put('/admin/users/{id}/permissions', function (Request $request, string $id) use ($actorCanManageTargetPermissions, $logAdminAction, $findUserForAdminAction, $readInput, $allowedRolePermissionSlugs) {
    $target = $findUserForAdminAction($id);
    if (!$target) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }
    $actor = $actorCanManageTargetPermissions($request, $target);

    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'permissions' => ['required', 'array'],
        'permissions.*' => ['string', 'max:64'],
    ])->validate();

    $allowed = $allowedRolePermissionSlugs($target->role);
    $requested = array_values(array_unique($payload['permissions']));
    $invalid = array_values(array_diff($requested, $allowed));

    if (!empty($invalid)) {
        throw ValidationException::withMessages([
            'permissions' => [
                'Permissions non autorisees pour ce role: ' . implode(', ', $invalid),
            ],
        ]);
    }

    PermissionResolver::syncUserPermissions($target, $requested);
    $target->api_token = null;
    $target->save();
    $logAdminAction($actor, 'update_user_permissions', $target->email, ['count' => count($requested)]);

    return response()->json([
        'message' => 'Permissions utilisateur mises a jour',
        'permissions' => PermissionResolver::effectiveSlugs($target->fresh()),
    ]);
});

Route::get('/admin/users', function (Request $request) use ($adminOnly) {
    $adminOnly($request, 'manage_users');
    return response()->json([
        'users' => User::query()
            ->with('permissions:id,slug')
            ->get(['id', 'name', 'email', 'role', 'active'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'active' => $u->active,
                'permissions' => $u->permissions->pluck('slug'),
            ]),
    ]);
});

Route::get('/admin/dashboard', function (Request $request) use ($adminOnly, $profileForUser) {
    $adminOnly($request, 'view_dashboard');

    $roleMatrix = RoleProfile::query()->get(['role', 'description', 'responsibilities', 'permissions']);
    $settings = SystemSetting::query()->get(['key', 'value']);
    $users = User::query()->get(['id', 'name', 'email', 'role', 'active']);

    $leavesByStatus = LeaveRequest::query()
        ->selectRaw('status, count(*) as total')
        ->groupBy('status')
        ->pluck('total', 'status');

    $employeesByService = EmployeeProfile::query()
        ->get(['service'])
        ->groupBy(fn ($p) => $p->service ?: 'Non assigne')
        ->map(fn ($group, $label) => ['label' => $label, 'total' => $group->count()])
        ->values();

    $leavesByMonth = LeaveRequest::query()
        ->where('created_at', '>=', now()->subMonths(6))
        ->get(['created_at'])
        ->groupBy(fn ($r) => Carbon::parse($r->created_at)->format('Y-m'))
        ->map(fn ($group, $month) => ['month' => $month, 'total' => $group->count()])
        ->values();

    return response()->json([
        'users' => $users,
        'roleMatrix' => $roleMatrix,
        'settings' => $settings,
        'stats' => [
            'employees_count' => User::where('role', 'employe')->count(),
            'users_count' => User::count(),
            'pending_leaves' => LeaveRequest::where('status', 'EN_ATTENTE')->count(),
            'active_trainings' => TrainingSession::whereIn('status', ['PLANIFIE', 'EN_COURS'])->count(),
            'evaluations_count' => PerformanceEvaluation::count(),
            'career_plans_count' => CareerPlan::where('status', 'ACTIF')->count(),
            'info_requests_pending' => HrInformationRequest::where('status', 'EN_ATTENTE')->count(),
        ],
        'charts' => [
            'leaves_by_status' => collect($leavesByStatus)->map(fn ($total, $status) => [
                'label' => $status,
                'total' => (int) $total,
            ])->values(),
            'employees_by_service' => $employeesByService,
            'leaves_by_month' => $leavesByMonth,
        ],
        'recent' => [
            'activities' => AuditLog::query()->orderByDesc('created_at')->limit(12)->get(),
            'leaves' => LeaveRequest::query()->latest()->limit(6)->get(),
            'evaluations' => PerformanceEvaluation::query()->latest()->limit(5)->get(),
            'info_requests' => HrInformationRequest::query()->latest()->limit(6)->get(),
        ],
        'departments' => EmployeeProfile::query()
            ->whereNotNull('service')
            ->where('service', '!=', '')
            ->distinct()
            ->orderBy('service')
            ->pluck('service'),
        'positions' => EmployeeProfile::query()
            ->whereNotNull('poste')
            ->where('poste', '!=', '')
            ->distinct()
            ->orderBy('poste')
            ->pluck('poste'),
    ]);
});

Route::get('/admin/notifications', function (Request $request) use ($adminOnly) {
    $adminOnly($request, 'view_dashboard');
    $items = [];
    $pending = LeaveRequest::where('status', 'EN_ATTENTE')->latest()->limit(8)->get();
    foreach ($pending as $leave) {
        $items[] = [
            'id' => 'leave-' . $leave->id,
            'type' => 'leave',
            'level' => 'warning',
            'title' => 'Demande de conge en attente',
            'message' => ($leave->employee_name ?? $leave->employee_email) . ' — ' . ($leave->from?->format('d/m/Y') ?? $leave->from),
            'created_at' => $leave->created_at,
            'read' => false,
        ];
    }
    $recentLogs = AuditLog::query()->orderByDesc('created_at')->limit(6)->get();
    foreach ($recentLogs as $log) {
        $items[] = [
            'id' => 'log-' . $log->id,
            'type' => 'audit',
            'level' => 'info',
            'title' => $log->action,
            'message' => ($log->actor_email ?? 'systeme') . ' → ' . ($log->target ?? '—'),
            'created_at' => $log->created_at,
            'read' => true,
        ];
    }
    usort($items, fn ($a, $b) => strtotime((string) ($b['created_at'] ?? 0)) <=> strtotime((string) ($a['created_at'] ?? 0)));

    return response()->json(['items' => $items, 'unread_count' => count(array_filter($items, fn ($i) => !$i['read']))]);
});

Route::get('/admin/reports/{type}', function (Request $request, string $type) use ($adminOnly, $profileForUser) {
    $adminOnly($request, 'manage_users');
    $accept = $request->header('Accept', '');

    if ($type === 'employees') {
        $rows = User::where('role', 'employe')->get()->map(function (User $u) use ($profileForUser) {
            $p = $profileForUser($u);
            return [
                'Matricule' => $p->matricule,
                'Nom' => $u->name,
                'Email' => $u->email,
                'Poste' => $p->poste,
                'Service' => $p->service,
                'Salaire' => $p->salaire,
                'Embauche' => $p->hire_date,
                'Actif' => $u->isLoginAllowed() ? 'Oui' : 'Non',
            ];
        });
    } elseif ($type === 'leaves') {
        $rows = LeaveRequest::query()->latest()->get()->map(fn ($r) => [
            'Employe' => $r->employee_name,
            'Email' => $r->employee_email,
            'Type' => $r->leave_type,
            'Du' => $r->from,
            'Au' => $r->to,
            'Statut' => $r->status,
            'Cree le' => $r->created_at,
        ]);
    } elseif ($type === 'evaluations') {
        $rows = PerformanceEvaluation::query()->latest()->get()->map(fn ($r) => [
            'Employe' => $r->employee_name,
            'Email' => $r->employee_email,
            'Periode' => $r->period_label,
            'Evaluateur' => $r->reviewer_name,
            'Score' => $r->score,
            'Statut' => $r->status,
            'Resume' => $r->summary,
        ]);
    } else {
        return response()->json(['error' => 'Rapport inconnu'], 404);
    }

    if (str_contains($accept, 'text/csv') || $request->query('format') === 'csv') {
        $lines = [];
        $arrayRows = $rows->values()->all();
        if (count($arrayRows) > 0) {
            $lines[] = implode(';', array_keys($arrayRows[0]));
            foreach ($arrayRows as $row) {
                $lines[] = implode(';', array_map(fn ($v) => str_replace(["\n", ';'], [' ', ','], (string) $v), $row));
            }
        }
        return response(implode("\n", $lines), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="rapport-' . $type . '.csv"',
        ]);
    }

    return response()->json(['rows' => $rows]);
});

Route::post('/admin/employees', function (Request $request) use ($hrOnly, $logAdminAction, $readInput, $profileForUser) {
    $admin = $hrOnly($request, 'manage_employees');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'name' => ['required', 'string', 'min:2'],
        'email' => ['required', 'email'],
        'password' => ['required', 'string', 'min:8'],
        'matricule' => ['nullable', 'string', 'max:40'],
        'poste' => ['nullable', 'string', 'max:120'],
        'service' => ['nullable', 'string', 'max:120'],
        'salaire' => ['nullable', 'numeric', 'min:0'],
        'hire_date' => ['nullable', 'date'],
    ])->validate();

    $email = strtolower($payload['email']);
    if (User::where('email', $email)->exists()) {
        return response()->json(['error' => 'Cet email existe deja'], 422);
    }

    $created = User::create([
        'name' => $payload['name'],
        'email' => $email,
        'password' => $payload['password'],
        'role' => 'employe',
        'active' => true,
    ]);

    $profile = $profileForUser($created);
    $profile->update([
        'matricule' => $payload['matricule'] ?? $profile->matricule,
        'poste' => $payload['poste'] ?? $profile->poste,
        'service' => $payload['service'] ?? $profile->service,
        'salaire' => $payload['salaire'] ?? $profile->salaire,
        'hire_date' => $payload['hire_date'] ?? $profile->hire_date,
    ]);

    $logAdminAction($admin, 'create_employee', $email, ['matricule' => $profile->matricule]);

    return response()->json(['message' => 'Employe cree', 'employee' => [
        'id' => $created->id,
        'name' => $created->name,
        'email' => $created->email,
        'matricule' => $profile->matricule,
        'poste' => $profile->poste,
        'service' => $profile->service,
    ]], 201);
});

Route::patch('/admin/employees/{id}', function (Request $request, string $id) use ($hrOnly, $logAdminAction, $findUserForAdminAction, $readInput, $profileForUser) {
    $admin = $hrOnly($request, 'manage_employees');
    $target = $findUserForAdminAction($id);
    if (!$target || $target->role !== 'employe') {
        return response()->json(['error' => 'Employe introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'name' => ['sometimes', 'string', 'min:2'],
        'matricule' => ['sometimes', 'string', 'max:40'],
        'poste' => ['sometimes', 'string', 'max:120'],
        'service' => ['sometimes', 'string', 'max:120'],
        'salaire' => ['nullable', 'numeric', 'min:0'],
        'hire_date' => ['nullable', 'date'],
        'active' => ['sometimes', 'boolean'],
    ])->validate();

    if (isset($payload['name'])) {
        $target->name = $payload['name'];
    }
    if (array_key_exists('active', $payload)) {
        $target->active = filter_var($payload['active'], FILTER_VALIDATE_BOOLEAN);
        if (!$target->active) {
            $target->api_token = null;
        }
    }
    $target->save();

    $profile = $profileForUser($target);
    $profile->update(collect($payload)->only(['matricule', 'poste', 'service', 'salaire', 'hire_date'])->filter()->all());

    $logAdminAction($admin, 'update_employee', $target->email);

    return response()->json(['message' => 'Employe mis a jour']);
});

Route::delete('/admin/employees/{id}', function (Request $request, string $id) use ($hrOnly, $logAdminAction, $findUserForAdminAction) {
    $admin = $hrOnly($request, 'manage_employees');
    $target = $findUserForAdminAction($id);
    if (!$target || $target->role !== 'employe') {
        return response()->json(['error' => 'Employe introuvable'], 404);
    }
    $email = $target->email;
    EmployeeProfile::where('user_email', strtolower($email))->delete();
    $target->delete();
    $logAdminAction($admin, 'delete_employee', $email);

    return response()->json(['message' => 'Employe supprime']);
});

Route::get('/admin/logs', function (Request $request) use ($adminOnly) {
    $adminOnly($request, 'manage_users');
    return response()->json([
        'logs' => AuditLog::query()->orderBy('created_at', 'desc')->limit(100)->get(),
    ]);
});

Route::post('/admin/users', function (Request $request) use ($adminOnly, $logAdminAction, $readInput) {
    $admin = $adminOnly($request, 'manage_users');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'name' => ['required', 'string', 'min:2'],
        'email' => ['required', 'email'],
        'password' => ['required', 'string', 'min:8'],
        'role' => ['required', 'regex:/^[a-z0-9_\\-]{2,40}$/'],
        'permissions' => ['nullable', 'array'],
        'permissions.*' => ['string', 'max:64'],
    ])->validate();

    $email = strtolower($payload['email']);
    if (User::where('email', $email)->exists()) {
        return response()->json(['error' => 'Cet email existe deja'], 422);
    }

    $roleModel = Role::query()->where('slug', $payload['role'])->first();

    $created = User::create([
        'name' => $payload['name'],
        'email' => $email,
        'password' => $payload['password'],
        'role' => $payload['role'],
        'role_id' => $roleModel?->id,
        'active' => true,
    ]);

    if (!empty($payload['permissions'])) {
        $allowed = $allowedRolePermissionSlugs($created->role);
        $requested = array_values(array_unique($payload['permissions']));
        $invalid = array_values(array_diff($requested, $allowed));

        if (!empty($invalid)) {
            throw ValidationException::withMessages([
                'permissions' => [
                    'Permissions non autorisees pour ce role: ' . implode(', ', $invalid),
                ],
            ]);
        }

        PermissionResolver::syncUserPermissions($created, $requested);
    } elseif ($created->role === 'employe') {
        PermissionResolver::syncUserPermissions($created, ['view_own_profile']);
    }

    PermissionResolver::attachRoleToUser($created);

    $logAdminAction($admin, 'create_user', $email, ['role' => $created->role]);
    return response()->json([
        'message' => 'Utilisateur cree',
        'permissions' => PermissionResolver::effectiveSlugs($created->fresh()),
    ], 201);
});

Route::patch('/admin/users/{id}', function (Request $request, string $id) use ($adminOnly, $logAdminAction, $findUserForAdminAction, $readInput) {
    $admin = $adminOnly($request, 'manage_users');
    $target = $findUserForAdminAction($id);
    if (!$target) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }

    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'name' => ['sometimes', 'string', 'min:2', 'max:120'],
        'email' => ['sometimes', 'email', 'max:200'],
        'password' => ['nullable', 'string', 'min:8'],
    ])->validate();

    if (isset($payload['email'])) {
        $nextEmail = strtolower(trim($payload['email']));
        $exists = User::query()
            ->where('email', $nextEmail)
            ->where('id', '!=', $target->id)
            ->exists();
        if ($exists) {
            return response()->json(['error' => 'Cet email existe deja'], 422);
        }
        $target->email = $nextEmail;
    }
    if (isset($payload['name'])) {
        $target->name = trim($payload['name']);
    }
    if (!empty($payload['password'])) {
        $target->password = $payload['password'];
        $target->api_token = null;
    }

    $target->save();
    $logAdminAction($admin, 'update_user', $target->email);

    return response()->json(['message' => 'Utilisateur mis a jour']);
});

Route::patch('/admin/users/{id}/role', function (Request $request, string $id) use ($adminOnly, $logAdminAction, $findUserForAdminAction, $readInput) {
    $admin = $adminOnly($request, 'manage_users');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'role' => ['required', 'regex:/^[a-z0-9_\\-]{2,40}$/'],
    ])->validate();

    $target = $findUserForAdminAction($id);
    if (!$target) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }

    $target->role = $payload['role'];
    $roleModel = Role::query()->where('slug', $payload['role'])->first();
    $target->role_id = $roleModel?->id;
    $target->save();
    PermissionResolver::attachRoleToUser($target);
    $logAdminAction($admin, 'change_role', $target->email, ['role' => $payload['role']]);

    return response()->json(['message' => 'Role mis a jour']);
});

Route::patch('/admin/users/{id}/access', function (Request $request, string $id) use ($adminOnly, $logAdminAction, $findUserForAdminAction, $readInput) {
    $admin = $adminOnly($request, 'manage_users');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'active' => ['required', 'boolean'],
    ])->validate();

    $target = $findUserForAdminAction($id);
    if (!$target) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }

    $wantsActive = filter_var($payload['active'], FILTER_VALIDATE_BOOLEAN);
    if (!$wantsActive && strtolower($target->email) === strtolower($admin->email)) {
        return response()->json(['error' => 'Vous ne pouvez pas desactiver votre propre compte.'], 422);
    }
    if (!$wantsActive && $target->role === 'admin') {
        $otherActiveAdmins = User::query()
            ->where('role', 'admin')
            ->where('email', '!=', strtolower($target->email))
            ->get()
            ->filter(fn (User $u) => $u->isLoginAllowed())
            ->count();
        if ($otherActiveAdmins === 0) {
            return response()->json(['error' => 'Impossible de desactiver le dernier administrateur actif.'], 422);
        }
    }

    $target->active = $wantsActive;
    if (!$target->active) {
        $target->api_token = null;
    }
    $target->save();
    $logAdminAction($admin, 'change_access', $target->email, ['active' => $target->active]);

    return response()->json(['message' => 'Acces mis a jour']);
});

Route::delete('/admin/users/{id}', function (Request $request, string $id) use ($adminOnly, $logAdminAction, $findUserForAdminAction) {
    $admin = $adminOnly($request, 'manage_users');
    $target = $findUserForAdminAction($id);
    if (!$target) {
        return response()->json(['error' => 'Utilisateur introuvable'], 404);
    }

    if ($target->email === $admin->email) {
        return response()->json(['error' => 'Impossible de supprimer votre propre compte admin'], 422);
    }

    $targetEmail = $target->email;
    $target->delete();
    $logAdminAction($admin, 'delete_user', $targetEmail);

    return response()->json(['message' => 'Utilisateur supprime']);
});

Route::put('/admin/roles/{role}', function (Request $request, string $role) use ($adminOnly, $logAdminAction, $allowedPermissionsByRole, $readInput) {
    $admin = $adminOnly($request, 'manage_users');
    if (!preg_match('/^[a-z0-9_\\-]{2,40}$/', $role)) {
        return response()->json(['error' => 'Role invalide'], 422);
    }

    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'description' => ['nullable', 'string', 'max:512'],
        'responsibilities' => ['required', 'array'],
        'permissions' => ['nullable', 'array'],
    ])->validate();

    $existingProfile = RoleProfile::query()->where('role', $role)->first();
    $requestedPermissions = array_values(array_unique($payload['permissions'] ?? ($existingProfile?->permissions ?? [])));
    if (array_key_exists($role, $allowedPermissionsByRole)) {
        $allowedPermissions = $allowedPermissionsByRole[$role];
        $invalidPermissions = array_values(array_diff($requestedPermissions, $allowedPermissions));
        if (!empty($invalidPermissions)) {
            return response()->json([
                'error' => 'Permissions non autorisees pour ce role',
                'invalid_permissions' => $invalidPermissions,
            ], 422);
        }
    }

    $update = [
        'responsibilities' => array_values($payload['responsibilities']),
        'permissions' => $requestedPermissions,
    ];
    if (array_key_exists('description', $payload)) {
        $update['description'] = $payload['description'];
    }

    RoleProfile::updateOrCreate(['role' => $role], $update);

    $logAdminAction($admin, 'update_role_profile', $role);
    return response()->json(['message' => 'Profil de role mis a jour']);
});

Route::put('/admin/settings', function (Request $request) use ($adminOnly, $logAdminAction, $readInput) {
    $admin = $adminOnly($request, 'manage_users');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'security_mode' => ['required', 'in:standard,strict'],
        'session_timeout_minutes' => ['required', 'integer', 'min:30', 'max:1440'],
        'company_name' => ['nullable', 'string', 'max:200'],
        'company_email' => ['nullable', 'email', 'max:200'],
        'company_phone' => ['nullable', 'string', 'max:40'],
        'company_address' => ['nullable', 'string', 'max:500'],
        'timezone' => ['nullable', 'string', 'max:80'],
        'currency' => ['nullable', 'string', 'max:10'],
        'annual_leave_days' => ['nullable', 'integer', 'min:0', 'max:60'],
        'probation_months' => ['nullable', 'integer', 'min:0', 'max:24'],
        'workday_start' => ['nullable', 'date_format:H:i'],
        'workday_end' => ['nullable', 'date_format:H:i'],
        'leave_alert_days' => ['nullable', 'integer', 'min:0', 'max:30'],
        'manager_validation_required' => ['nullable', 'boolean'],
        'email_notifications' => ['nullable', 'boolean'],
        'maintenance_mode' => ['nullable', 'boolean'],
    ])->validate();

    SystemSetting::updateOrCreate(['key' => 'security_mode'], ['value' => $payload['security_mode']]);
    SystemSetting::updateOrCreate(['key' => 'session_timeout_minutes'], ['value' => $payload['session_timeout_minutes']]);

    foreach ([
        'company_name',
        'company_email',
        'company_phone',
        'company_address',
        'timezone',
        'currency',
        'annual_leave_days',
        'probation_months',
        'workday_start',
        'workday_end',
        'leave_alert_days',
    ] as $key) {
        if (array_key_exists($key, $payload)) {
            SystemSetting::updateOrCreate(['key' => $key], ['value' => $payload[$key] ?? '']);
        }
    }
    if (array_key_exists('manager_validation_required', $payload)) {
        SystemSetting::updateOrCreate(
            ['key' => 'manager_validation_required'],
            ['value' => filter_var($payload['manager_validation_required'], FILTER_VALIDATE_BOOLEAN) ? '1' : '0']
        );
    }
    if (array_key_exists('email_notifications', $payload)) {
        SystemSetting::updateOrCreate(
            ['key' => 'email_notifications'],
            ['value' => filter_var($payload['email_notifications'], FILTER_VALIDATE_BOOLEAN) ? '1' : '0']
        );
    }
    if (array_key_exists('maintenance_mode', $payload)) {
        SystemSetting::updateOrCreate(
            ['key' => 'maintenance_mode'],
            ['value' => filter_var($payload['maintenance_mode'], FILTER_VALIDATE_BOOLEAN) ? '1' : '0']
        );
    }

    $logAdminAction($admin, 'update_settings', 'system', $payload);
    return response()->json(['message' => 'Parametres enregistres']);
});

Route::get('/employee/profile', function (Request $request) use ($employeeOnly, $profileForUser) {
    $user = $employeeOnly($request, 'view_own_profile');
    $emp = $profileForUser($user);
    return response()->json([
        'profile' => [
            'name' => $user->name,
            'email' => $user->email,
            'matricule' => $emp->matricule,
            'poste' => $emp->poste,
            'post' => $emp->poste,
            'service' => $emp->service,
            'salaire' => $emp->salaire,
            'hire_date' => $emp->hire_date,
        ],
    ]);
});

Route::get('/employee/leave-requests', function (Request $request) use ($employeeOnly) {
    $user = $employeeOnly($request, 'view_own_leaves');

    $requests = LeaveRequest::where('employee_email', $user->email)->latest()->get();
    return response()->json(['requests' => $requests]);
});

Route::post('/employee/leave-requests', function (Request $request) use ($employeeOnly, $readInput) {
    $user = $employeeOnly($request, 'view_own_leaves');

    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'from' => ['required', 'date'],
        'to' => ['required', 'date', 'after_or_equal:from'],
        'leave_type' => ['nullable', 'in:ANNUEL,MALADIE,SANS_SOLDE,AUTRE'],
    ])->validate();

    LeaveRequest::create([
        'employee_name' => $user->name,
        'employee_email' => $user->email,
        'from' => $payload['from'],
        'to' => $payload['to'],
        'leave_type' => $payload['leave_type'] ?? 'ANNUEL',
        'status' => 'EN_ATTENTE',
    ]);

    return response()->json(['message' => 'Demande envoyee'], 201);
});

Route::get('/employee/evaluations', function (Request $request) use ($employeeOnly) {
    $user = $employeeOnly($request, 'view_own_evaluations');
    $items = PerformanceEvaluation::where('employee_email', strtolower($user->email))
        ->latest()
        ->get();
    return response()->json(['items' => $items]);
});

Route::patch('/employee/evaluations/{id}/participation', function (Request $request, string $id) use ($employeeOnly, $readInput) {
    $user = $employeeOnly($request, 'view_own_evaluations');
    $row = PerformanceEvaluation::find($id);
    if (!$row || strtolower($row->employee_email) !== strtolower($user->email)) {
        return response()->json(['error' => 'Evaluation introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'employee_comment' => ['required', 'string', 'min:5', 'max:4000'],
    ])->validate();

    $row->employee_comment = trim($payload['employee_comment']);
    $row->employee_participation_at = now();
    $row->save();

    return response()->json(['item' => $row->fresh(), 'message' => 'Participation enregistree']);
});

Route::get('/employee/trainings', function (Request $request) use ($employeeOnly) {
    $user = $employeeOnly($request, 'view_own_trainings');
    $email = strtolower($user->email);
    $sessions = TrainingSession::query()
        ->whereIn('status', ['PLANIFIE', 'EN_COURS'])
        ->latest()
        ->get()
        ->map(function (TrainingSession $session) use ($email) {
            $participants = array_map('strtolower', $session->participants ?? []);
            $enrolled = in_array($email, $participants, true);
            return [
                'id' => $session->id,
                'title' => $session->title,
                'trainer' => $session->trainer,
                'location' => $session->location,
                'start_date' => $session->start_date,
                'end_date' => $session->end_date,
                'capacity' => $session->capacity,
                'enrolled_count' => count($participants),
                'status' => $session->status,
                'description' => $session->description,
                'is_enrolled' => $enrolled,
            ];
        });
    return response()->json(['items' => $sessions]);
});

Route::get('/employee/career', function (Request $request) use ($employeeOnly) {
    $user = $employeeOnly($request, 'view_own_career');
    $plan = CareerPlan::where('employee_email', strtolower($user->email))->first();

    return response()->json(['plan' => $plan]);
});

Route::get('/employee/hr-info-requests', function (Request $request) use ($employeeOnly) {
    $user = $employeeOnly($request, 'view_own_hr_info');
    $items = HrInformationRequest::query()
        ->where('employee_email', strtolower($user->email))
        ->latest()
        ->get();

    return response()->json(['items' => $items]);
});

Route::post('/employee/hr-info-requests', function (Request $request) use ($employeeOnly, $readInput) {
    $user = $employeeOnly($request, 'view_own_hr_info');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'subject' => ['required', 'string', 'max:200'],
        'message' => ['required', 'string', 'min:8', 'max:4000'],
    ])->validate();

    $row = HrInformationRequest::create([
        'employee_name' => $user->name,
        'employee_email' => strtolower($user->email),
        'subject' => trim($payload['subject']),
        'message' => trim($payload['message']),
        'status' => 'EN_ATTENTE',
    ]);

    AuditLog::create([
        'actor_email' => $user->email,
        'action' => 'hr_info_request',
        'target' => $row->subject,
        'meta' => ['request_id' => $row->id],
        'created_at' => now(),
    ]);

    return response()->json(['item' => $row, 'message' => 'Demande envoyee au service RH'], 201);
});

Route::post('/employee/trainings/{id}/enroll', function (Request $request, string $id) use ($employeeOnly) {
    $user = $employeeOnly($request, 'view_own_trainings');
    $session = TrainingSession::find($id);
    if (!$session) {
        return response()->json(['error' => 'Formation introuvable'], 404);
    }
    if (!in_array($session->status ?? 'PLANIFIE', ['PLANIFIE', 'EN_COURS'], true)) {
        return response()->json(['error' => 'Inscriptions fermees pour cette session'], 422);
    }
    $email = strtolower($user->email);
    $participants = array_values(array_unique(array_map('strtolower', $session->participants ?? [])));
    if (in_array($email, $participants, true)) {
        return response()->json(['message' => 'Deja inscrit a cette formation']);
    }
    $capacity = (int) ($session->capacity ?? 20);
    if (count($participants) >= $capacity) {
        return response()->json(['error' => 'Session complete'], 422);
    }
    $participants[] = $email;
    $session->participants = $participants;
    $session->enrolled = count($participants);
    $session->save();
    return response()->json(['message' => 'Inscription confirmee']);
});

Route::get('/hr/employees', function (Request $request) use ($hrOrAdminRead, $profileForUser) {
    $hrOrAdminRead($request, 'manage_employees');
    $users = User::query()
        ->where('role', 'employe')
        ->with('permissions:id,slug')
        ->get(['id', 'name', 'email', 'role', 'active']);
    $items = $users->map(function (User $u) use ($profileForUser) {
        $p = $profileForUser($u);
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'active' => $u->isLoginAllowed(),
            'matricule' => $p->matricule,
            'poste' => $p->poste,
            'service' => $p->service,
            'salaire' => $p->salaire,
            'hire_date' => $p->hire_date,
            'permissions' => $u->permissions->pluck('slug'),
        ];
    });
    return response()->json(['items' => $items]);
});

Route::patch('/hr/employees/{id}/profile', function (Request $request, string $id) use ($hrOnly, $findUserForAdminAction, $readInput, $profileForUser) {
    $hrOnly($request, 'manage_employees');
    $target = $findUserForAdminAction($id);
    if (!$target || $target->role !== 'employe') {
        return response()->json(['error' => 'Employe introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'matricule' => ['sometimes', 'string', 'max:40'],
        'poste' => ['sometimes', 'string', 'max:120'],
        'service' => ['sometimes', 'string', 'max:120'],
        'salaire' => ['nullable', 'numeric', 'min:0'],
        'hire_date' => ['nullable', 'date'],
    ])->validate();
    $profile = $profileForUser($target);
    $profile->update($payload);
    return response()->json(['profile' => $profile->fresh()]);
});

Route::get('/hr/leave-requests', function (Request $request) use ($hrOrAdminRead) {
    $hrOrAdminRead($request, 'manage_leave');

    return response()->json(['requests' => LeaveRequest::latest()->get()]);
});

Route::patch('/hr/leave-requests/{leaveRequest}', function (Request $request, LeaveRequest $leaveRequest) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_leave');

    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'status' => ['required', 'in:EN_ATTENTE,VALIDE,REFUSE'],
    ])->validate();

    $leaveRequest->update(['status' => $payload['status']]);

    return response()->json(['message' => 'Statut mis a jour']);
});

Route::get('/hr/dashboard', function (Request $request) use ($hrOrAdminRead) {
    $hrOrAdminRead($request, 'view_dashboard');

    return response()->json([
        'stats' => [
            'pending_leaves' => LeaveRequest::where('status', 'EN_ATTENTE')->count(),
            'active_recruitment' => RecruitmentCandidate::whereNotIn('status', ['EMBAUCHE', 'REFUS'])->count(),
            'planned_evaluations' => PerformanceEvaluation::where('status', 'PLANIFIE')->count(),
            'running_trainings' => TrainingSession::whereIn('status', ['PLANIFIE', 'EN_COURS'])->count(),
            'active_careers' => CareerPlan::where('status', 'ACTIF')->count(),
            'employees_count' => User::where('role', 'employe')->where('active', true)->count(),
            'info_requests_pending' => HrInformationRequest::where('status', 'EN_ATTENTE')->count(),
        ],
        'recent' => [
            'leaves' => LeaveRequest::query()->latest()->limit(8)->get(),
            'recruitment' => RecruitmentCandidate::query()->latest()->limit(6)->get(),
        ],
    ]);
});

Route::get('/hr/info-requests', function (Request $request) use ($hrOrAdminRead) {
    $hrOrAdminRead($request, 'manage_hr_info', 'manage_employees');
    return response()->json(['items' => HrInformationRequest::query()->latest()->get()]);
});

Route::patch('/hr/info-requests/{id}', function (Request $request, string $id) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_hr_info', 'manage_employees');
    $row = HrInformationRequest::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'status' => ['sometimes', 'in:EN_ATTENTE,EN_COURS,TRAITEE,FERMEE'],
        'response' => ['nullable', 'string', 'max:4000'],
    ])->validate();

    $row->fill($payload);
    if (isset($payload['status']) && in_array($payload['status'], ['TRAITEE', 'FERMEE'], true)) {
        $row->resolved_at = now();
    }
    $row->save();

    return response()->json(['item' => $row->fresh()]);
});

Route::get('/hr/recruitment', function (Request $request) use ($hrOrAdminRead) {
    $hrOrAdminRead($request, 'manage_recruitment');
    return response()->json(['items' => RecruitmentCandidate::query()->latest()->get()]);
});

Route::post('/hr/recruitment', function (Request $request) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_recruitment');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'job_title' => ['required', 'string', 'max:200'],
        'candidate_name' => ['required', 'string', 'max:200'],
        'email' => ['required', 'email', 'max:200'],
        'phone' => ['nullable', 'string', 'max:40'],
        'status' => ['nullable', 'in:NOUVEAU,PRESENTE,ENTRETIEN,OFFRE,EMBAUCHE,REFUS'],
        'notes' => ['nullable', 'string', 'max:2000'],
    ])->validate();
    $payload['status'] = $payload['status'] ?? 'NOUVEAU';
    $row = RecruitmentCandidate::create($payload);
    return response()->json(['item' => $row], 201);
});

Route::patch('/hr/recruitment/{id}', function (Request $request, string $id) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_recruitment');
    $row = RecruitmentCandidate::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'job_title' => ['sometimes', 'string', 'max:200'],
        'candidate_name' => ['sometimes', 'string', 'max:200'],
        'email' => ['sometimes', 'email', 'max:200'],
        'phone' => ['nullable', 'string', 'max:40'],
        'status' => ['sometimes', 'in:NOUVEAU,PRESENTE,ENTRETIEN,OFFRE,EMBAUCHE,REFUS'],
        'notes' => ['nullable', 'string', 'max:2000'],
    ])->validate();
    $row->update($payload);
    return response()->json(['item' => $row->fresh()]);
});

Route::delete('/hr/recruitment/{id}', function (Request $request, string $id) use ($hrOnly) {
    $hrOnly($request, 'manage_recruitment');
    $row = RecruitmentCandidate::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $row->delete();
    return response()->json(['message' => 'Supprime']);
});

Route::get('/hr/evaluations', function (Request $request) use ($hrOrAdminRead) {
    $hrOrAdminRead($request, 'manage_evaluations');
    return response()->json(['items' => PerformanceEvaluation::query()->latest()->get()]);
});

Route::post('/hr/evaluations', function (Request $request) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_evaluations');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'employee_name' => ['required', 'string', 'max:200'],
        'employee_email' => ['required', 'email', 'max:200'],
        'period_label' => ['required', 'string', 'max:120'],
        'reviewer_name' => ['required', 'string', 'max:200'],
        'score' => ['nullable', 'integer', 'min:1', 'max:5'],
        'summary' => ['nullable', 'string', 'max:4000'],
        'status' => ['nullable', 'in:PLANIFIE,REALISE'],
    ])->validate();
    $payload['status'] = $payload['status'] ?? 'PLANIFIE';
    $row = PerformanceEvaluation::create($payload);
    return response()->json(['item' => $row], 201);
});

Route::patch('/hr/evaluations/{id}', function (Request $request, string $id) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_evaluations');
    $row = PerformanceEvaluation::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'employee_name' => ['sometimes', 'string', 'max:200'],
        'employee_email' => ['sometimes', 'email', 'max:200'],
        'period_label' => ['sometimes', 'string', 'max:120'],
        'reviewer_name' => ['sometimes', 'string', 'max:200'],
        'score' => ['nullable', 'integer', 'min:1', 'max:5'],
        'summary' => ['nullable', 'string', 'max:4000'],
        'status' => ['sometimes', 'in:PLANIFIE,REALISE'],
    ])->validate();
    $row->update($payload);
    return response()->json(['item' => $row->fresh()]);
});

Route::delete('/hr/evaluations/{id}', function (Request $request, string $id) use ($hrOnly) {
    $hrOnly($request, 'manage_evaluations');
    $row = PerformanceEvaluation::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $row->delete();
    return response()->json(['message' => 'Supprime']);
});

Route::get('/hr/trainings', function (Request $request) use ($hrOrAdminRead) {
    $hrOrAdminRead($request, 'manage_training');
    return response()->json(['items' => TrainingSession::query()->latest()->get()]);
});

Route::post('/hr/trainings', function (Request $request) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_training');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'title' => ['required', 'string', 'max:200'],
        'trainer' => ['required', 'string', 'max:200'],
        'location' => ['nullable', 'string', 'max:200'],
        'start_date' => ['required', 'date'],
        'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        'capacity' => ['nullable', 'integer', 'min:1', 'max:5000'],
        'enrolled' => ['nullable', 'integer', 'min:0', 'max:5000'],
        'status' => ['nullable', 'in:PLANIFIE,EN_COURS,TERMINE'],
        'description' => ['nullable', 'string', 'max:4000'],
    ])->validate();
    $payload['capacity'] = $payload['capacity'] ?? 20;
    $payload['enrolled'] = $payload['enrolled'] ?? 0;
    $payload['status'] = $payload['status'] ?? 'PLANIFIE';
    $row = TrainingSession::create($payload);
    return response()->json(['item' => $row], 201);
});

Route::patch('/hr/trainings/{id}', function (Request $request, string $id) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_training');
    $row = TrainingSession::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'title' => ['sometimes', 'string', 'max:200'],
        'trainer' => ['sometimes', 'string', 'max:200'],
        'location' => ['nullable', 'string', 'max:200'],
        'start_date' => ['sometimes', 'date'],
        'end_date' => ['sometimes', 'date'],
        'capacity' => ['nullable', 'integer', 'min:1', 'max:5000'],
        'enrolled' => ['nullable', 'integer', 'min:0', 'max:5000'],
        'status' => ['sometimes', 'in:PLANIFIE,EN_COURS,TERMINE'],
        'description' => ['nullable', 'string', 'max:4000'],
    ])->validate();
    $row->update($payload);
    return response()->json(['item' => $row->fresh()]);
});

Route::delete('/hr/trainings/{id}', function (Request $request, string $id) use ($hrOnly) {
    $hrOnly($request, 'manage_training');
    $row = TrainingSession::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $row->delete();
    return response()->json(['message' => 'Supprime']);
});

Route::get('/hr/careers', function (Request $request) use ($hrOrAdminRead) {
    $hrOrAdminRead($request, 'manage_careers');
    return response()->json(['items' => CareerPlan::query()->latest()->get()]);
});

Route::post('/hr/careers', function (Request $request) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_careers');
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'employee_name' => ['required', 'string', 'max:200'],
        'employee_email' => ['required', 'email', 'max:200'],
        'current_role' => ['required', 'string', 'max:200'],
        'target_role' => ['required', 'string', 'max:200'],
        'milestones' => ['nullable', 'array'],
        'milestones.*.title' => ['required_with:milestones', 'string', 'max:300'],
        'milestones.*.due_date' => ['nullable', 'date'],
        'milestones.*.done' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string', 'max:4000'],
        'status' => ['nullable', 'in:ACTIF,TERMINE'],
    ])->validate();
    $payload['status'] = $payload['status'] ?? 'ACTIF';
    $payload['milestones'] = $payload['milestones'] ?? [];
    $row = CareerPlan::create($payload);
    return response()->json(['item' => $row], 201);
});

Route::patch('/hr/careers/{id}', function (Request $request, string $id) use ($hrOnly, $readInput) {
    $hrOnly($request, 'manage_careers');
    $row = CareerPlan::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $payload = $readInput($request);
    $payload = Validator::make($payload, [
        'employee_name' => ['sometimes', 'string', 'max:200'],
        'employee_email' => ['sometimes', 'email', 'max:200'],
        'current_role' => ['sometimes', 'string', 'max:200'],
        'target_role' => ['sometimes', 'string', 'max:200'],
        'milestones' => ['nullable', 'array'],
        'milestones.*.title' => ['required_with:milestones', 'string', 'max:300'],
        'milestones.*.due_date' => ['nullable', 'date'],
        'milestones.*.done' => ['nullable', 'boolean'],
        'notes' => ['nullable', 'string', 'max:4000'],
        'status' => ['sometimes', 'in:ACTIF,TERMINE'],
    ])->validate();
    $row->update($payload);
    return response()->json(['item' => $row->fresh()]);
});

Route::delete('/hr/careers/{id}', function (Request $request, string $id) use ($hrOnly) {
    $hrOnly($request, 'manage_careers');
    $row = CareerPlan::find($id);
    if (!$row) {
        return response()->json(['error' => 'Introuvable'], 404);
    }
    $row->delete();
    return response()->json(['message' => 'Supprime']);
});

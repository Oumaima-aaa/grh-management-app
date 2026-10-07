<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;

class PermissionResolver
{
    /** @var array<int, string>|null */
    private static ?array $allSlugsCache = null;

    public const HR_SLUGS = [
        'view_dashboard',
        'manage_employees',
        'manage_hr_info',
        'manage_leave',
        'manage_training',
        'manage_evaluations',
        'manage_recruitment',
        'manage_careers',
    ];

    public const ADMIN_EXTRA_SLUGS = [
        'manage_users',
        'view_reports',
    ];

    /** Modules espace employe (donnees strictement liees au compte connecte). */
    public const EMPLOYEE_SLUGS = [
        'view_own_profile',
        'view_own_leaves',
        'view_own_trainings',
        'view_own_evaluations',
        'view_own_career',
        'view_own_hr_info',
    ];

    public static function catalog(): array
    {
        return [
            ['slug' => 'manage_users', 'name' => 'Gestion des utilisateurs'],
            ['slug' => 'manage_employees', 'name' => 'Gestion des employes (tous)'],
            ['slug' => 'manage_hr_info', 'name' => 'Demandes infos RH (employes)'],
            ['slug' => 'manage_leave', 'name' => 'Gestion des conges (tous)'],
            ['slug' => 'manage_training', 'name' => 'Gestion des formations (tous)'],
            ['slug' => 'manage_evaluations', 'name' => 'Gestion des evaluations (tous)'],
            ['slug' => 'manage_recruitment', 'name' => 'Gestion du recrutement'],
            ['slug' => 'manage_careers', 'name' => 'Gestion des carrieres (tous)'],
            ['slug' => 'view_reports', 'name' => 'Gestion des rapports'],
            ['slug' => 'view_dashboard', 'name' => 'Tableau de bord'],
            ['slug' => 'view_own_profile', 'name' => 'Mon profil uniquement'],
            ['slug' => 'view_own_leaves', 'name' => 'Mes conges'],
            ['slug' => 'view_own_trainings', 'name' => 'Mes formations'],
            ['slug' => 'view_own_evaluations', 'name' => 'Mes evaluations'],
            ['slug' => 'view_own_career', 'name' => 'Ma carriere'],
            ['slug' => 'view_own_hr_info', 'name' => 'Mes infos RH'],
        ];
    }

    public static function allSlugs(): array
    {
        if (self::$allSlugsCache === null) {
            self::$allSlugsCache = Permission::query()->pluck('slug')->all();
            if (empty(self::$allSlugsCache)) {
                self::$allSlugsCache = array_column(self::catalog(), 'slug');
            }
        }

        return self::$allSlugsCache;
    }

    public static function invalidateCache(): void
    {
        self::$allSlugsCache = null;
    }

    /**
     * Permissions effectives = uniquement celles assignees a cet utilisateur (user_permissions).
     *
     * @return list<string>
     */
    public static function effectiveSlugs(User $user): array
    {
        $user->loadMissing('permissions');

        return $user->permissions->pluck('slug')->unique()->values()->all();
    }

    public static function has(User $user, string $slug): bool
    {
        return in_array($slug, self::effectiveSlugs($user), true);
    }

    public static function hasAny(User $user, array $slugs): bool
    {
        if (empty($slugs)) {
            return true;
        }
        $effective = self::effectiveSlugs($user);

        return !empty(array_intersect($slugs, $effective));
    }

    public static function syncUserPermissions(User $user, array $slugs): void
    {
        $valid = Permission::query()->whereIn('slug', $slugs)->pluck('id', 'slug');
        $user->permissions()->sync($valid->values()->all());
    }

    /**
     * Initialise les permissions d un compte (seeder / premiere creation) sans toucher aux autres utilisateurs.
     *
     * @return list<string>
     */
    public static function bootstrapUserIfEmpty(User $user, array $slugs): array
    {
        $user->loadMissing('permissions');
        if ($user->permissions->isNotEmpty()) {
            return self::effectiveSlugs($user);
        }
        self::syncUserPermissions($user, $slugs);

        return self::effectiveSlugs($user->fresh());
    }

    public static function attachRoleToUser(User $user): void
    {
        if (!$user->role) {
            return;
        }
        $role = Role::query()->where('slug', $user->role)->first();
        if ($role) {
            $user->role_id = $role->id;
            $user->saveQuietly();
        }
    }

    public static function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'permissions' => self::effectiveSlugs($user),
        ];
    }

    /** Permissions minimales apres connexion (comptes demo / migration). */
    public static function bootstrapAfterAuth(User $user): void
    {
        $slugs = self::effectiveSlugs($user);

        if ($user->role === 'admin' && empty($slugs)) {
            self::syncUserPermissions($user, self::allSlugs());
            return;
        }

        if ($user->role === 'employe' && empty($slugs)) {
            self::syncUserPermissions($user, ['view_own_profile']);
            return;
        }

        if ($user->role === 'rh') {
            if (empty($slugs)) {
                self::syncUserPermissions($user, self::HR_SLUGS);
                return;
            }
            if (!in_array('manage_hr_info', $slugs, true)) {
                self::syncUserPermissions($user, array_values(array_unique([...$slugs, 'manage_hr_info'])));
            }
        }
    }
}

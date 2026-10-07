<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionResolver;
use Illuminate\Database\Seeder;

class PermissionsSeeder extends Seeder
{
    /** Comptes demo : permissions individuelles reinitialisees a chaque seed. */
    private const DEMO_USER_PERMISSIONS = [
        'admin@grh.local' => 'all',
        'rh@grh.local' => 'rh',
        'employe@grh.local' => 'employe_full',
    ];

    public function run(): void
    {
        PermissionResolver::invalidateCache();

        foreach (PermissionResolver::catalog() as $item) {
            Permission::updateOrCreate(
                ['slug' => $item['slug']],
                ['name' => $item['name']]
            );
        }

        foreach ([
            ['slug' => 'admin', 'name' => 'Administrateur', 'description' => 'Pilotage global, utilisateurs et securite.'],
            ['slug' => 'rh', 'name' => 'Responsable RH', 'description' => 'Gestion operationnelle des ressources humaines.'],
            ['slug' => 'employe', 'name' => 'Employe', 'description' => 'Espace collaborateur.'],
        ] as $def) {
            Role::updateOrCreate(
                ['slug' => $def['slug']],
                ['name' => $def['name'], 'description' => $def['description']]
            );
        }

        $allSlugs = PermissionResolver::allSlugs();
        $hrSlugs = PermissionResolver::HR_SLUGS;

        User::query()->each(function (User $user) {
            PermissionResolver::attachRoleToUser($user);
        });

        foreach (self::DEMO_USER_PERMISSIONS as $email => $preset) {
            $user = User::query()->where('email', $email)->first();
            if (!$user) {
                continue;
            }
            $slugs = match ($preset) {
                'all' => $allSlugs,
                'rh' => $hrSlugs,
                'employe_full' => PermissionResolver::EMPLOYEE_SLUGS,
                default => [],
            };
            PermissionResolver::syncUserPermissions($user, $slugs);
        }

        // Autres comptes sans aucune permission assignee : initialisation unique (ne pas ecraser les comptes deja configures).
        User::query()->with('permissions')->each(function (User $user) use ($allSlugs, $hrSlugs) {
            if (isset(self::DEMO_USER_PERMISSIONS[$user->email])) {
                return;
            }
            if ($user->permissions->isNotEmpty()) {
                return;
            }
            $bootstrap = match ($user->role) {
                'admin' => $allSlugs,
                'rh' => $hrSlugs,
                'employe' => ['view_own_profile'],
                default => [],
            };
            if (!empty($bootstrap)) {
                PermissionResolver::syncUserPermissions($user, $bootstrap);
            }
        });
    }
}

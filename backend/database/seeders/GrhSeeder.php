<?php

namespace Database\Seeders;

use App\Models\CareerPlan;
use App\Models\EmployeeProfile;
use App\Models\LeaveRequest;
use App\Models\PerformanceEvaluation;
use App\Models\RecruitmentCandidate;
use App\Models\RoleProfile;
use App\Models\SystemSetting;
use App\Models\TrainingSession;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class GrhSeeder extends Seeder
{
    public const DEMO_ACCOUNTS = [
        [
            'name' => 'Administrateur',
            'email' => 'admin@grh.local',
            'password' => 'Admin123!',
            'role' => 'admin',
        ],
        [
            'name' => 'Responsable RH',
            'email' => 'rh@grh.local',
            'password' => 'Rh123456!',
            'role' => 'rh',
        ],
        [
            'name' => 'Employe Standard',
            'email' => 'employe@grh.local',
            'password' => 'Emp123456!',
            'role' => 'employe',
        ],
    ];

    /** Employes supplementaires (mot de passe demo : Emp123456!) */
    private const EXTRA_EMPLOYEES = [
        [
            'name' => 'Khalil Moussaoui',
            'email' => 'khalil.moussaoui@grh.local',
            'matricule' => 'EMP-1002',
            'poste' => 'Developpeur web',
            'service' => 'Informatique',
            'salaire' => 12000,
            'hire_date' => '2023-09-01',
        ],
        [
            'name' => 'Fatima El Amrani',
            'email' => 'fatima.elamrani@grh.local',
            'matricule' => 'EMP-1003',
            'poste' => 'Assistante RH',
            'service' => 'Ressources humaines',
            'salaire' => 9500,
            'hire_date' => '2024-01-10',
        ],
        [
            'name' => 'Younes Tazi',
            'email' => 'younes.tazi@grh.local',
            'matricule' => 'EMP-1004',
            'poste' => 'Comptable',
            'service' => 'Finance',
            'salaire' => 11000,
            'hire_date' => '2022-06-20',
        ],
        [
            'name' => 'Salma Bennani',
            'email' => 'salma.bennani@grh.local',
            'matricule' => 'EMP-1005',
            'poste' => 'Chargee de communication',
            'service' => 'Marketing',
            'salaire' => 9800,
            'hire_date' => '2024-07-01',
        ],
    ];

    public function run(): void
    {
        $this->call(PermissionsSeeder::class);
        $this->seedAccounts();
        $this->seedRolesAndSettings();
        $this->seedEmployees();
        $this->seedLeaveRequests();
        $this->seedTrainings();
        $this->seedEvaluations();
        $this->seedRecruitment();
        $this->seedCareerPlans();
        $this->call(HrInfoRequestsSeeder::class);
    }

    private function seedAccounts(): void
    {
        foreach (self::DEMO_ACCOUNTS as $account) {
            $user = User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'password' => Hash::make($account['password']),
                    'role' => $account['role'],
                    'active' => true,
                ]
            );
            \App\Services\PermissionResolver::attachRoleToUser($user);
        }

        foreach (self::EXTRA_EMPLOYEES as $emp) {
            User::updateOrCreate(
                ['email' => $emp['email']],
                [
                    'name' => $emp['name'],
                    'password' => Hash::make('Emp123456!'),
                    'role' => 'employe',
                    'active' => true,
                ]
            );
        }
    }

    private function seedRolesAndSettings(): void
    {
        $roleDefaults = [
            'admin' => [
                'description' => 'Administration globale de la plateforme',
                'responsibilities' => [
                    'Gerer les utilisateurs',
                    'Gerer les roles',
                    'Configurer les parametres systeme',
                    'Consulter les journaux d activite',
                    'Superviser les donnees RH en consultation',
                ],
                'permissions' => [],
            ],
            'rh' => [
                'description' => 'Pilotage operationnel RH',
                'responsibilities' => [
                    'Gerer les employes',
                    'Approuver les conges',
                    'Gerer le recrutement',
                    'Gerer les evaluations',
                    'Gerer les formations',
                    'Gerer les carrieres',
                    'Traiter les demandes d informations RH',
                ],
                'permissions' => [],
            ],
            'employe' => [
                'description' => 'Acces collaborateur',
                'responsibilities' => [
                    'Consulter son profil',
                    'Demander un conge',
                    'Demander des informations RH',
                    'Participer aux evaluations',
                    'S inscrire aux formations',
                    'Consulter son plan de carriere',
                ],
                'permissions' => [],
            ],
        ];

        foreach ($roleDefaults as $role => $profile) {
            RoleProfile::updateOrCreate(['role' => $role], $profile);
        }

        SystemSetting::updateOrCreate(['key' => 'security_mode'], ['value' => 'standard']);
        SystemSetting::updateOrCreate(['key' => 'session_timeout_minutes'], ['value' => 120]);
        SystemSetting::updateOrCreate(['key' => 'timezone'], ['value' => 'Africa/Casablanca']);
        SystemSetting::updateOrCreate(['key' => 'currency'], ['value' => 'MAD']);
        SystemSetting::updateOrCreate(['key' => 'annual_leave_days'], ['value' => 22]);
        SystemSetting::updateOrCreate(['key' => 'probation_months'], ['value' => 6]);
        SystemSetting::updateOrCreate(['key' => 'workday_start'], ['value' => '09:00']);
        SystemSetting::updateOrCreate(['key' => 'workday_end'], ['value' => '18:00']);
        SystemSetting::updateOrCreate(['key' => 'leave_alert_days'], ['value' => 3]);
        SystemSetting::updateOrCreate(['key' => 'manager_validation_required'], ['value' => '0']);
    }

    private function seedEmployees(): void
    {
        EmployeeProfile::updateOrCreate(
            ['user_email' => 'employe@grh.local'],
            [
                'matricule' => 'EMP-1001',
                'poste' => 'Technicien support',
                'service' => 'Operations',
                'salaire' => 8500,
                'hire_date' => '2024-03-15',
            ]
        );

        foreach (self::EXTRA_EMPLOYEES as $emp) {
            EmployeeProfile::updateOrCreate(
                ['user_email' => $emp['email']],
                [
                    'matricule' => $emp['matricule'],
                    'poste' => $emp['poste'],
                    'service' => $emp['service'],
                    'salaire' => $emp['salaire'],
                    'hire_date' => $emp['hire_date'],
                ]
            );
        }
    }

    private function seedLeaveRequests(): void
    {
        $leaves = [
            [
                'employee_name' => 'Employe Standard',
                'employee_email' => 'employe@grh.local',
                'from' => now()->addDays(10)->format('Y-m-d'),
                'to' => now()->addDays(14)->format('Y-m-d'),
                'leave_type' => 'ANNUEL',
                'status' => 'EN_ATTENTE',
            ],
            [
                'employee_name' => 'Employe Standard',
                'employee_email' => 'employe@grh.local',
                'from' => now()->subMonths(2)->format('Y-m-d'),
                'to' => now()->subMonths(2)->addDays(3)->format('Y-m-d'),
                'leave_type' => 'ANNUEL',
                'status' => 'VALIDE',
            ],
            [
                'employee_name' => 'Khalil Moussaoui',
                'employee_email' => 'khalil.moussaoui@grh.local',
                'from' => now()->addDays(5)->format('Y-m-d'),
                'to' => now()->addDays(7)->format('Y-m-d'),
                'leave_type' => 'ANNUEL',
                'status' => 'EN_ATTENTE',
            ],
            [
                'employee_name' => 'Khalil Moussaoui',
                'employee_email' => 'khalil.moussaoui@grh.local',
                'from' => now()->subWeeks(3)->format('Y-m-d'),
                'to' => now()->subWeeks(3)->addDays(2)->format('Y-m-d'),
                'leave_type' => 'MALADIE',
                'status' => 'VALIDE',
            ],
            [
                'employee_name' => 'Fatima El Amrani',
                'employee_email' => 'fatima.elamrani@grh.local',
                'from' => now()->addDays(20)->format('Y-m-d'),
                'to' => now()->addDays(25)->format('Y-m-d'),
                'leave_type' => 'ANNUEL',
                'status' => 'EN_ATTENTE',
            ],
            [
                'employee_name' => 'Fatima El Amrani',
                'employee_email' => 'fatima.elamrani@grh.local',
                'from' => now()->subMonth()->format('Y-m-d'),
                'to' => now()->subMonth()->addDays(1)->format('Y-m-d'),
                'leave_type' => 'SANS_SOLDE',
                'status' => 'REFUSE',
            ],
            [
                'employee_name' => 'Younes Tazi',
                'employee_email' => 'younes.tazi@grh.local',
                'from' => now()->addWeeks(3)->format('Y-m-d'),
                'to' => now()->addWeeks(3)->addDays(4)->format('Y-m-d'),
                'leave_type' => 'ANNUEL',
                'status' => 'EN_ATTENTE',
            ],
            [
                'employee_name' => 'Younes Tazi',
                'employee_email' => 'younes.tazi@grh.local',
                'from' => now()->subMonths(1)->format('Y-m-d'),
                'to' => now()->subMonths(1)->addDays(2)->format('Y-m-d'),
                'leave_type' => 'AUTRE',
                'status' => 'VALIDE',
            ],
            [
                'employee_name' => 'Salma Bennani',
                'employee_email' => 'salma.bennani@grh.local',
                'from' => now()->addDays(3)->format('Y-m-d'),
                'to' => now()->addDays(6)->format('Y-m-d'),
                'leave_type' => 'ANNUEL',
                'status' => 'EN_ATTENTE',
            ],
            [
                'employee_name' => 'Salma Bennani',
                'employee_email' => 'salma.bennani@grh.local',
                'from' => now()->subWeeks(6)->format('Y-m-d'),
                'to' => now()->subWeeks(6)->addDays(5)->format('Y-m-d'),
                'leave_type' => 'ANNUEL',
                'status' => 'VALIDE',
            ],
        ];

        foreach ($leaves as $leave) {
            LeaveRequest::updateOrCreate(
                [
                    'employee_email' => $leave['employee_email'],
                    'from' => $leave['from'],
                    'to' => $leave['to'],
                ],
                $leave
            );
        }
    }

    private function seedTrainings(): void
    {
        $sessions = [
            [
                'title' => 'Reglementation travail et conges',
                'trainer' => 'Cabinet Social Conseil',
                'location' => 'Salle A - siege',
                'start_date' => now()->addWeeks(2)->format('Y-m-d'),
                'end_date' => now()->addWeeks(2)->format('Y-m-d'),
                'capacity' => 24,
                'enrolled' => 3,
                'participants' => ['employe@grh.local', 'fatima.elamrani@grh.local', 'khalil.moussaoui@grh.local'],
                'status' => 'PLANIFIE',
                'description' => 'Mise a jour du droit du travail applicable aux equipes.',
            ],
            [
                'title' => 'Securite informatique et RGPD',
                'trainer' => 'CyberSec Academy',
                'location' => 'Salle B - siege',
                'start_date' => now()->addWeeks(4)->format('Y-m-d'),
                'end_date' => now()->addWeeks(4)->addDays(1)->format('Y-m-d'),
                'capacity' => 20,
                'enrolled' => 2,
                'participants' => ['khalil.moussaoui@grh.local', 'younes.tazi@grh.local'],
                'status' => 'PLANIFIE',
                'description' => 'Bonnes pratiques de securite et protection des donnees personnelles.',
            ],
            [
                'title' => 'Communication interne efficace',
                'trainer' => 'Institut Formation Pro',
                'location' => 'Visio Teams',
                'start_date' => now()->addWeek()->format('Y-m-d'),
                'end_date' => now()->addWeek()->format('Y-m-d'),
                'capacity' => 30,
                'enrolled' => 2,
                'participants' => ['salma.bennani@grh.local', 'employe@grh.local'],
                'status' => 'EN_COURS',
                'description' => 'Techniques de communication et gestion des conflits en entreprise.',
            ],
            [
                'title' => 'Excel avance — reporting RH',
                'trainer' => 'FormaPlus',
                'location' => 'Salle C - siege',
                'start_date' => now()->subWeeks(2)->format('Y-m-d'),
                'end_date' => now()->subWeeks(2)->format('Y-m-d'),
                'capacity' => 15,
                'enrolled' => 2,
                'participants' => ['fatima.elamrani@grh.local', 'younes.tazi@grh.local'],
                'status' => 'TERMINE',
                'description' => 'Tableaux croises dynamiques et tableaux de bord RH.',
            ],
            [
                'title' => 'Leadership et gestion d equipe',
                'trainer' => 'Leadership Institute',
                'location' => 'Centre de formation externe',
                'start_date' => now()->addMonths(2)->format('Y-m-d'),
                'end_date' => now()->addMonths(2)->addDays(2)->format('Y-m-d'),
                'capacity' => 12,
                'enrolled' => 0,
                'participants' => [],
                'status' => 'PLANIFIE',
                'description' => 'Programme destine aux futurs managers et coordinateurs.',
            ],
        ];

        foreach ($sessions as $session) {
            TrainingSession::updateOrCreate(
                ['title' => $session['title']],
                $session
            );
        }
    }

    private function seedEvaluations(): void
    {
        $evaluations = [
            [
                'employee_name' => 'Employe Standard',
                'employee_email' => 'employe@grh.local',
                'period_label' => '2026 - S1',
                'reviewer_name' => 'Responsable RH',
                'score' => 4,
                'summary' => 'Bonnes bases, renforcer la communication interne.',
                'status' => 'PLANIFIE',
            ],
            [
                'employee_name' => 'Employe Standard',
                'employee_email' => 'employe@grh.local',
                'period_label' => '2025 - S2',
                'reviewer_name' => 'Responsable RH',
                'score' => 3,
                'summary' => 'Progression satisfaisante, autonomie en amelioration.',
                'status' => 'REALISE',
            ],
            [
                'employee_name' => 'Khalil Moussaoui',
                'employee_email' => 'khalil.moussaoui@grh.local',
                'period_label' => '2026 - S1',
                'reviewer_name' => 'Responsable RH',
                'score' => 5,
                'summary' => 'Excellent travail technique, mentor junior recommande.',
                'status' => 'PLANIFIE',
            ],
            [
                'employee_name' => 'Khalil Moussaoui',
                'employee_email' => 'khalil.moussaoui@grh.local',
                'period_label' => '2025 - S2',
                'reviewer_name' => 'Responsable RH',
                'score' => 4,
                'summary' => 'Livraisons dans les delais, bonne collaboration inter-equipes.',
                'status' => 'REALISE',
            ],
            [
                'employee_name' => 'Fatima El Amrani',
                'employee_email' => 'fatima.elamrani@grh.local',
                'period_label' => '2026 - S1',
                'reviewer_name' => 'Responsable RH',
                'score' => 4,
                'summary' => 'Rigueur administrative, a developper le recrutement.',
                'status' => 'PLANIFIE',
            ],
            [
                'employee_name' => 'Younes Tazi',
                'employee_email' => 'younes.tazi@grh.local',
                'period_label' => '2026 - S1',
                'reviewer_name' => 'Responsable RH',
                'score' => 3,
                'summary' => 'Fiabilite comptable, ameliorer la reactivite sur les clotures.',
                'status' => 'PLANIFIE',
            ],
            [
                'employee_name' => 'Younes Tazi',
                'employee_email' => 'younes.tazi@grh.local',
                'period_label' => '2025 - S2',
                'reviewer_name' => 'Responsable RH',
                'score' => 4,
                'summary' => 'Bonne maitrise des outils, respect des echeances fiscales.',
                'status' => 'REALISE',
            ],
            [
                'employee_name' => 'Salma Bennani',
                'employee_email' => 'salma.bennani@grh.local',
                'period_label' => '2026 - S1',
                'reviewer_name' => 'Responsable RH',
                'score' => 4,
                'summary' => 'Creativite remarquable sur les campagnes internes.',
                'status' => 'PLANIFIE',
            ],
        ];

        foreach ($evaluations as $eval) {
            PerformanceEvaluation::updateOrCreate(
                [
                    'employee_email' => $eval['employee_email'],
                    'period_label' => $eval['period_label'],
                ],
                $eval
            );
        }
    }

    private function seedRecruitment(): void
    {
        RecruitmentCandidate::updateOrCreate(
            ['email' => 'amine.benali@example.com'],
            [
                'job_title' => 'Developpeur full-stack',
                'candidate_name' => 'Amine Benali',
                'phone' => '+212 6 00 00 00 01',
                'status' => 'ENTRETIEN',
                'notes' => 'Deuxieme entretien prevu avec le lead technique.',
            ]
        );
        RecruitmentCandidate::updateOrCreate(
            ['email' => 'sara.idrissi@example.com'],
            [
                'job_title' => 'Charge de paie',
                'candidate_name' => 'Sara Idrissi',
                'phone' => null,
                'status' => 'NOUVEAU',
                'notes' => 'CV recu via LinkedIn.',
            ]
        );
    }

    private function seedCareerPlans(): void
    {
        CareerPlan::updateOrCreate(
            ['employee_email' => 'employe@grh.local'],
            [
                'employee_name' => 'Employe Standard',
                'current_role' => 'Technicien support',
                'target_role' => 'Coordinateur equipe',
                'milestones' => [
                    ['title' => 'Suivre module leadership', 'due_date' => now()->addMonths(3)->format('Y-m-d'), 'done' => false],
                    ['title' => 'Piloter un mini-projet transverse', 'due_date' => now()->addMonths(6)->format('Y-m-d'), 'done' => false],
                ],
                'notes' => 'Plan discute en entretien annuel.',
                'status' => 'ACTIF',
            ]
        );

        CareerPlan::updateOrCreate(
            ['employee_email' => 'khalil.moussaoui@grh.local'],
            [
                'employee_name' => 'Khalil Moussaoui',
                'current_role' => 'Developpeur web',
                'target_role' => 'Lead developpeur',
                'milestones' => [
                    ['title' => 'Certification cloud', 'due_date' => now()->addMonths(4)->format('Y-m-d'), 'done' => false],
                    ['title' => 'Encadrer un stagiaire', 'due_date' => now()->addMonths(8)->format('Y-m-d'), 'done' => false],
                ],
                'notes' => 'Potentiel identifie pour evolution technique.',
                'status' => 'ACTIF',
            ]
        );
    }

}

# Conformite au rapport PFE — GRH Pro

Document de reference : rapport **Oumaima Jabrawi**, filiere **WFS204**, encadrant **M. Benkirane Mohcine** (OFPPT).

## 1. Contexte et objectifs (chapitre 1)

| Exigence rapport | Implementation |
|------------------|----------------|
| Centraliser la gestion RH | Application web unique `GRH Pro` |
| Trois acteurs (Admin, RH, Employe) | Routage par role apres `POST /api/login` |
| Securiser les acces | Token Bearer (`api_token`), comptes `active`, audit connexion |
| Stack React + Laravel + MySQL | `frontend/` Vite + React, `backend/` Laravel 12, MySQL + Eloquent |

## 2. Analyse fonctionnelle (chapitre 2)

### 2.1 Administrateur

| Fonction rapport | Module / API |
|------------------|--------------|
| Gestion utilisateurs | Admin → Utilisateurs, `POST/PATCH/DELETE` admin users |
| Roles et permissions | Admin → Roles, `role_profiles` |
| Parametres systeme | Admin → Parametres, `system_settings` |
| Logs | Admin → Logs, `audit_logs` |
| Supervision RH (lecture) | Sections RH en **consultation seule** (pas de validation ni creation) |

### 2.2 Responsable RH

| Fonction rapport | Module / API |
|------------------|--------------|
| Conges (validation) | RH → Conges, `PATCH /api/hr/leave-requests/{id}` |
| Recrutement | RH → Recrutement, CRUD `/api/hr/recruitment` |
| Evaluations | RH → Evaluations, CRUD `/api/hr/evaluations` |
| Formations | RH → Formations, CRUD `/api/hr/trainings` |
| Carrieres | RH → Carrieres, CRUD `/api/hr/careers` |
| Fiches employes | RH → Employes, CRUD `/api/hr/employees` |
| Tableau de bord | KPIs + `GET /api/hr/dashboard` |

### 2.3 Employe

| Fonction rapport | Module / API |
|------------------|--------------|
| Profil | Employe → Profil, `GET /api/employee/profile` |
| Demandes de conge | `GET/POST /api/employee/leave-requests` |
| Historique conges | Liste dans onglet Conges |
| Formations | `GET /api/employee/trainings`, inscription `POST .../enroll` |
| Evaluations | `GET /api/employee/evaluations` |
| Plan de carriere (lecture) | `GET /api/employee/career` |

## 3. Conception technique (chapitre 3)

### 3.1 Backend

- `app/Models/` : modeles Eloquent (User, EmployeeProfile, LeaveRequest, etc.)
- `database/migrations/` : schema MySQL aligne MLD
- `database/seeders/GrhSeeder.php` : donnees de demonstration
- `routes/api.php` : API REST (auth, admin, hr, employee)
- `config/cors.php` : CORS pour le frontend Vite

### 3.2 Frontend

- `src/App.jsx` : routage par role
- `src/admin/` : espace administrateur
- `src/hr/` : espace responsable RH (operations)
- `src/employee/` : espace employe
- `src/api.js` : client HTTP + token
- Design responsive (`viewport`, sidebar mobile admin)

### 3.3 Endpoints principaux

Voir `README.md` section « API REST ».

## 4. MCD / MLD (entites)

| Entite rapport | Table MySQL |
|----------------|-------------|
| UTILISATEUR | `users` |
| ROLE | `role_profiles` + `users.role` |
| EMPLOYE | `employee_profiles` |
| CONGE | `leave_requests` |
| FORMATION | `training_sessions` |
| EVALUATION | `performance_evaluations` |
| CARRIERE | `career_plans` |

Extension : `recruitment_candidates` (recrutement, module RH du rapport fonctionnel).

## 5. Comptes de demonstration

| Role | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@grh.local | Admin123! |
| RH | rh@grh.local | Rh123456! |
| Employe | employe@grh.local | Emp123456! |

Seed : `php artisan db:seed --class=GrhSeeder` ou `POST /api/seed`.

## 6. Ecarts volontaires / notes jury

- Les routes conges du rapport (`/api/conges`) sont implementees sous `/employee/leave-requests` et `/hr/leave-requests` (meme logique metier).
- L administrateur ne modifie pas les donnees RH (choix projet + coherence diagramme acteurs ch. 2.3.1).
- La logique metier est centralisee dans `routes/api.php` (rapport cite aussi une structure MVC evolutive).

# GRH Pro - React + Laravel + MySQL

Application de gestion des ressources humaines avec trois espaces:
- Admin
- Responsable RH
- Employe

Le projet suit vos diagrammes (authentification obligatoire et zones par acteur).

## Stack

- Frontend: React + Vite
- Backend: Laravel 12 (API REST)
- Base de donnees: **MySQL** (aligne avec le MLD du rapport)

## Structure

- `frontend/` interface React moderne
- `backend/` API Laravel

## Comptes par defaut

Apres seed:
- Admin: `admin@grh.local` / `Admin123!`
- Responsable RH: `rh@grh.local` / `Rh123456!`
- Employe: `employe@grh.local` / `Emp123456!`

## Prerequis backend

- PHP 8.2+ avec extensions `pdo_mysql`, `mbstring`, `openssl`
- MySQL 8+ ou MariaDB (XAMPP, WAMP, Docker, etc.)
- Base `grh` creee (phpMyAdmin ou `CREATE DATABASE grh CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)

## Lancer le backend (Laravel)

1. `cd backend`
2. `composer install`
3. Configurer `backend/.env` :
   - `DB_CONNECTION=mysql`
   - `DB_DATABASE=grh`
   - `DB_USERNAME` / `DB_PASSWORD`
4. Creer la base MySQL `grh` (phpMyAdmin ou `CREATE DATABASE grh;`)
5. `php artisan migrate`
6. `php artisan db:seed --class=GrhSeeder` (ou `php run_seed.php` ou `POST http://127.0.0.1:8000/api/seed`)
7. `php artisan serve --host=127.0.0.1 --port=8000`

**Projet sous OneDrive :** si `php artisan` affiche que `bootstrap/cache` n'est pas accessible en ecriture, une jonction vers `%TEMP%\grh-bootstrap-cache` a ete configuree. Sinon deplacez le projet hors de OneDrive.

## Gmail + reinitialisation mot de passe

Dans `backend/.env`, configurez:
- `APP_FRONTEND_URL=http://localhost:5173`
- `MAIL_MAILER=smtp`
- `MAIL_HOST=smtp.gmail.com`
- `MAIL_PORT=587`
- `MAIL_USERNAME=<votre_gmail>`
- `MAIL_PASSWORD=<mot_de_passe_application_gmail>`
- `MAIL_FROM_ADDRESS=<votre_gmail>`

Endpoints disponibles:
- `POST /api/forgot-password` (envoi du lien)
- `POST /api/reset-password` (mise a jour du mot de passe)

## Lancer le frontend

1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Ouvrir `http://localhost:5173`

Le frontend utilise un proxy Vite vers l'API (`/api` -> `127.0.0.1:8000`).

## Alignement avec le rapport (MCD / acteurs)

| Entite rapport | Table MySQL | Statut |
|----------------|-------------|--------|
| UTILISATEUR | `users` | Complet (auth, roles, active) |
| ROLE | `role_profiles` + champ `role` | Complet |
| EMPLOYE | `employee_profiles` | Complet |
| CONGE | `leave_requests` | Complet (+ type de conge) |
| FORMATION | `training_sessions` | Complet |
| EVALUATION | `performance_evaluations` | Complet |
| CARRIERE | `career_plans` | Complet |

## Modules fonctionnels

- **Admin** : utilisateurs, roles/permissions, parametres, logs d audit ; supervision RH en lecture seule
- **Responsable RH** : conges, recrutement, evaluations, formations, carrieres, fiches employes, tableau de bord
- **Employe** : profil, demandes de conge, formations, evaluations, plan de carriere (lecture)

## API REST (extrait rapport ch. 3.3)

| Methode | Route | Role |
|---------|-------|------|
| POST | `/api/login` | Public |
| POST | `/api/logout` | Authentifie |
| GET | `/api/admin/dashboard` | Admin |
| GET/POST/PATCH/DELETE | `/api/admin/users` | Admin |
| GET/PATCH | `/api/admin/roles`, `/api/admin/settings` | Admin |
| GET | `/api/hr/dashboard` | RH, Admin (lecture) |
| GET/PATCH | `/api/hr/leave-requests` | RH (ecriture), Admin (lecture) |
| CRUD | `/api/hr/recruitment`, `/api/hr/evaluations`, `/api/hr/trainings`, `/api/hr/careers`, `/api/hr/employees` | RH |
| GET/POST | `/api/employee/profile`, `/api/employee/leave-requests` | Employe |
| GET | `/api/employee/trainings`, `/api/employee/evaluations`, `/api/employee/career` | Employe |

Documentation detaillee : `docs/RAPPORT_CONFORMITE.md`.

## CORS

Le backend autorise par defaut `http://localhost:5173` et `http://127.0.0.1:5173`. Personnaliser dans `.env` :

```
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Secours compte bloque

Si un compte demo affiche « Compte desactive » :

```bash
cd backend
php fix_accounts_active.php
```

Ou : `POST http://127.0.0.1:8000/api/accounts/reactivate-demo`

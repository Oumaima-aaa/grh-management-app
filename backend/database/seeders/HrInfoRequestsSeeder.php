<?php

namespace Database\Seeders;

use App\Models\HrInformationRequest;
use Illuminate\Database\Seeder;

class HrInfoRequestsSeeder extends Seeder
{
    public function run(): void
    {
        $requests = [
            [
                'employee_name' => 'Employe Demo',
                'employee_email' => 'employe@grh.local',
                'subject' => 'Attestation de travail',
                'message' => 'Bonjour, j aurais besoin d une attestation de travail pour mon dossier bancaire. Merci.',
                'status' => 'EN_ATTENTE',
                'created_at' => now()->subDays(1),
            ],
            [
                'employee_name' => 'Employe Demo',
                'employee_email' => 'employe@grh.local',
                'subject' => 'Question sur les heures supplementaires',
                'message' => 'Comment declarer mes heures supplementaires du mois dernier ?',
                'status' => 'EN_ATTENTE',
                'created_at' => now()->subHours(6),
            ],
            [
                'employee_name' => 'Khalil Moussaoui',
                'employee_email' => 'khalil.moussaoui@grh.local',
                'subject' => 'Report de conges',
                'message' => 'Est-il possible de reporter mes jours de conge non pris sur l annee prochaine ?',
                'status' => 'EN_COURS',
                'response' => 'Votre demande est en cours d analyse par le service paie.',
                'created_at' => now()->subDays(3),
            ],
            [
                'employee_name' => 'Khalil Moussaoui',
                'employee_email' => 'khalil.moussaoui@grh.local',
                'subject' => 'Formation certifiante',
                'message' => 'Je souhaite suivre une formation cloud. Existe-t-il un budget formation ?',
                'status' => 'EN_ATTENTE',
                'created_at' => now()->subDays(2),
            ],
            [
                'employee_name' => 'Fatima El Amrani',
                'employee_email' => 'fatima.elamrani@grh.local',
                'subject' => 'Bulletin de paie manquant',
                'message' => 'Je n ai pas recu mon bulletin de paie du mois dernier. Pouvez-vous me le renvoyer ?',
                'status' => 'EN_ATTENTE',
                'created_at' => now()->subDays(4),
            ],
            [
                'employee_name' => 'Fatima El Amrani',
                'employee_email' => 'fatima.elamrani@grh.local',
                'subject' => 'Conge maternite — documents',
                'message' => 'Quels documents dois-je fournir pour une demande de conge maternite ?',
                'status' => 'EN_COURS',
                'response' => 'Liste des pieces envoyee par email. Merci de completer le dossier avant vendredi.',
                'created_at' => now()->subDays(5),
            ],
            [
                'employee_name' => 'Younes Tazi',
                'employee_email' => 'younes.tazi@grh.local',
                'subject' => 'Remboursement frais de transport',
                'message' => 'Je n ai pas encore recu le remboursement de mes tickets de bus pour janvier.',
                'status' => 'EN_ATTENTE',
                'created_at' => now()->subDays(2),
            ],
            [
                'employee_name' => 'Younes Tazi',
                'employee_email' => 'younes.tazi@grh.local',
                'subject' => 'Attestation CNSS',
                'message' => 'Besoin d une attestation CNSS pour un credit immobilier.',
                'status' => 'TRAITEE',
                'response' => 'Document disponible en reception. Pensez a apporter une piece d identite.',
                'resolved_at' => now()->subDays(1),
                'created_at' => now()->subDays(7),
            ],
            [
                'employee_name' => 'Salma Bennani',
                'employee_email' => 'salma.bennani@grh.local',
                'subject' => 'Changement d adresse',
                'message' => 'Je demenage le mois prochain. Quelle procedure pour mettre a jour mon adresse ?',
                'status' => 'TRAITEE',
                'response' => 'Merci de nous envoyer un justificatif de domicile. Mise a jour effectuee sous 48h.',
                'resolved_at' => now()->subDays(2),
                'created_at' => now()->subDays(10),
            ],
            [
                'employee_name' => 'Salma Bennani',
                'employee_email' => 'salma.bennani@grh.local',
                'subject' => 'Teletravail ponctuel',
                'message' => 'Puis-je travailler en teletravail deux jours par semaine le mois prochain ?',
                'status' => 'FERMEE',
                'response' => 'Accord du manager requis. Merci de faire valider par votre responsable.',
                'resolved_at' => now()->subDays(14),
                'created_at' => now()->subDays(20),
            ],
        ];

        foreach ($requests as $req) {
            HrInformationRequest::updateOrCreate(
                [
                    'employee_email' => $req['employee_email'],
                    'subject' => $req['subject'],
                ],
                $req
            );
        }
    }
}

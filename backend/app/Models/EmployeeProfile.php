<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeProfile extends Model
{
    protected $fillable = [
        'user_email',
        'matricule',
        'poste',
        'service',
        'salaire',
        'hire_date',
    ];

    protected function casts(): array
    {
        return [
            'salaire' => 'decimal:2',
            'hire_date' => 'date',
        ];
    }
}

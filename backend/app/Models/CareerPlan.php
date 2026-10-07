<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CareerPlan extends Model
{
    protected $fillable = [
        'employee_name',
        'employee_email',
        'current_role',
        'target_role',
        'milestones',
        'notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'milestones' => 'array',
        ];
    }
}

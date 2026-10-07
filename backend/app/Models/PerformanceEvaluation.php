<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PerformanceEvaluation extends Model
{
    protected $fillable = [
        'employee_name',
        'employee_email',
        'period_label',
        'reviewer_name',
        'score',
        'summary',
        'employee_comment',
        'employee_participation_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'employee_participation_at' => 'datetime',
        ];
    }
}

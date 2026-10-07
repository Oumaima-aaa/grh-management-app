<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrainingSession extends Model
{
    protected $fillable = [
        'title',
        'trainer',
        'location',
        'start_date',
        'end_date',
        'capacity',
        'enrolled',
        'participants',
        'status',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'participants' => 'array',
        ];
    }
}

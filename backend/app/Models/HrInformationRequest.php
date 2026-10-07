<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrInformationRequest extends Model
{
    protected $fillable = [
        'employee_name',
        'employee_email',
        'subject',
        'message',
        'response',
        'status',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
        ];
    }
}

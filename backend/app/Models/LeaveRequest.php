<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveRequest extends Model
{
    protected $fillable = [
        'employee_name',
        'employee_email',
        'from',
        'to',
        'leave_type',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'from' => 'date',
            'to' => 'date',
        ];
    }
}

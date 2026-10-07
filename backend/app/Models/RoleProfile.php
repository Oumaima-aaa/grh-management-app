<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoleProfile extends Model
{
    protected $fillable = [
        'role',
        'description',
        'responsibilities',
        'permissions',
    ];

    protected function casts(): array
    {
        return [
            'responsibilities' => 'array',
            'permissions' => 'array',
        ];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PasswordResetToken extends Model
{
    protected $table = 'password_reset_tokens';

    public $incrementing = false;

    public $timestamps = false;

    protected $primaryKey = 'email';

    protected $keyType = 'string';

    protected $fillable = [
        'email',
        'token',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }
}

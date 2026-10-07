<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecruitmentCandidate extends Model
{
    protected $fillable = [
        'job_title',
        'candidate_name',
        'email',
        'phone',
        'status',
        'notes',
    ];
}

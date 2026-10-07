<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('performance_evaluations', function (Blueprint $table) {
            $table->text('employee_comment')->nullable()->after('summary');
            $table->timestamp('employee_participation_at')->nullable()->after('employee_comment');
        });
    }

    public function down(): void
    {
        Schema::table('performance_evaluations', function (Blueprint $table) {
            $table->dropColumn(['employee_comment', 'employee_participation_at']);
        });
    }
};

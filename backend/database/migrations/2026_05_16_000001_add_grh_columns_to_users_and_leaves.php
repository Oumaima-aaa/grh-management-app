<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'active')) {
                $table->boolean('active')->default(true)->after('role');
            }
        });

        if (Schema::hasTable('leave_requests') && ! Schema::hasColumn('leave_requests', 'leave_type')) {
            Schema::table('leave_requests', function (Blueprint $table) {
                $table->string('leave_type', 32)->default('ANNUEL')->after('employee_email');
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'active')) {
                $table->dropColumn('active');
            }
        });

        if (Schema::hasColumn('leave_requests', 'leave_type')) {
            Schema::table('leave_requests', function (Blueprint $table) {
                $table->dropColumn('leave_type');
            });
        }
    }
};

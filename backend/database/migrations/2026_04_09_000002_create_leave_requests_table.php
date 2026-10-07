<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();
            $table->string('employee_name');
            $table->string('employee_email')->index();
            $table->string('leave_type', 32)->default('ANNUEL');
            $table->date('from');
            $table->date('to');
            $table->string('status')->default('EN_ATTENTE');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_requests');
    }
};

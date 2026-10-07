<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_information_requests', function (Blueprint $table) {
            $table->id();
            $table->string('employee_name', 200);
            $table->string('employee_email', 200)->index();
            $table->string('subject', 200);
            $table->text('message');
            $table->text('response')->nullable();
            $table->string('status', 20)->default('EN_ATTENTE')->index();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_information_requests');
    }
};

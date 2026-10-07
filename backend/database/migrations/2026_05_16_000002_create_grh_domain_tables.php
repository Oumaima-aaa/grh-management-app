<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('role', 32)->unique();
            $table->json('responsibilities')->nullable();
            $table->json('permissions')->nullable();
            $table->timestamps();
        });

        Schema::create('employee_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('user_email')->unique();
            $table->string('matricule', 64)->nullable();
            $table->string('poste', 128)->nullable();
            $table->string('service', 128)->nullable();
            $table->decimal('salaire', 12, 2)->nullable();
            $table->date('hire_date')->nullable();
            $table->timestamps();
        });

        Schema::create('recruitment_candidates', function (Blueprint $table) {
            $table->id();
            $table->string('job_title');
            $table->string('candidate_name');
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('status', 32)->default('NOUVEAU');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('performance_evaluations', function (Blueprint $table) {
            $table->id();
            $table->string('employee_name');
            $table->string('employee_email')->index();
            $table->string('period_label', 120)->nullable();
            $table->string('reviewer_name')->nullable();
            $table->unsignedTinyInteger('score')->nullable();
            $table->text('summary')->nullable();
            $table->string('status', 32)->default('PLANIFIE');
            $table->timestamps();
        });

        Schema::create('training_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('trainer')->nullable();
            $table->string('location')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->unsignedSmallInteger('capacity')->default(20);
            $table->unsignedSmallInteger('enrolled')->default(0);
            $table->json('participants')->nullable();
            $table->string('status', 32)->default('PLANIFIE');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('career_plans', function (Blueprint $table) {
            $table->id();
            $table->string('employee_name');
            $table->string('employee_email')->index();
            $table->string('current_role')->nullable();
            $table->string('target_role')->nullable();
            $table->json('milestones')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 32)->default('ACTIF');
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('actor_email')->nullable();
            $table->string('action');
            $table->string('target')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('system_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('career_plans');
        Schema::dropIfExists('training_sessions');
        Schema::dropIfExists('performance_evaluations');
        Schema::dropIfExists('recruitment_candidates');
        Schema::dropIfExists('employee_profiles');
        Schema::dropIfExists('role_profiles');
    }
};

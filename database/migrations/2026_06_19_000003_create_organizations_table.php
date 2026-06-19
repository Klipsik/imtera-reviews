<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('yandex_url');
            $table->string('yandex_org_id')->index();
            $table->string('name');
            $table->string('slug')->unique();
            $table->foreignId('city_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('organization_type_id')->nullable()->constrained()->nullOnDelete();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->decimal('average_rating', 3, 1)->default(0);
            $table->integer('ratings_count')->default(0);
            $table->integer('reviews_count')->default(0);
            $table->json('raw_data')->nullable();
            $table->json('meta')->nullable();
            $table->string('sync_status')->default('pending');
            $table->json('sync_progress')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};

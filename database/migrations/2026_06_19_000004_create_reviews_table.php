<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->string('yandex_review_id');
            $table->string('author_name');
            $table->string('author_avatar')->nullable();
            $table->timestamp('review_date');
            $table->text('text')->nullable();
            $table->decimal('rating', 3, 1)->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'yandex_review_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('reviews') || $this->hasCompositeUnique()) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_yandex_review_id_unique');
        }

        Schema::table('reviews', function (Blueprint $table) {
            try {
                $table->dropUnique(['yandex_review_id']);
            } catch (Throwable) {
                // already migrated or fresh schema
            }

            $table->unique(['organization_id', 'yandex_review_id']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('reviews')) {
            return;
        }

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropUnique(['organization_id', 'yandex_review_id']);
            $table->unique('yandex_review_id');
        });
    }

    private function hasCompositeUnique(): bool
    {
        foreach (Schema::getIndexes('reviews') as $index) {
            $columns = $index['columns'] ?? [];

            if (($index['unique'] ?? false) && $columns === ['organization_id', 'yandex_review_id']) {
                return true;
            }
        }

        return false;
    }
};

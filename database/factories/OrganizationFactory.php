<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<\App\Models\Organization>
 */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        $orgId = (string) fake()->numberBetween(100000, 999999);

        return [
            'user_id' => User::factory(),
            'yandex_url' => "https://yandex.ru/maps/org/test/{$orgId}/",
            'yandex_org_id' => $orgId,
            'name' => fake()->company(),
            'slug' => Str::slug(fake()->unique()->company()),
            'average_rating' => fake()->randomFloat(1, 1, 5),
            'ratings_count' => fake()->numberBetween(0, 500),
            'reviews_count' => fake()->numberBetween(0, 600),
            'sync_status' => 'pending',
            'sync_progress' => ['phase' => 'pending', 'saved' => 0],
        ];
    }
}

<?php

namespace Tests\Unit;

use App\Models\Organization;
use App\Models\User;
use App\Services\Organization\OrganizationMetadataService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrganizationMetadataServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_apply_parser_data_persists_ratings_and_reviews_counts(): void
    {
        $organization = Organization::factory()->create([
            'user_id' => User::factory()->create()->id,
            'ratings_count' => 0,
            'reviews_count' => 0,
            'average_rating' => 0,
        ]);

        $organization = app(OrganizationMetadataService::class)->applyParserData($organization, [
            'name' => 'Hatimaki',
            'org_id' => '199612008855',
            'average_rating' => 4.5,
            'ratings_count' => 780,
            'reviews_count' => 398,
            'address' => 'ул. Стройкова, 67А',
            'phone' => null,
            'city' => 'Рязань',
            'category' => 'Суши-бар',
            'raw_data' => [
                'rating' => 4.5,
                'ratingsCount' => 780,
                'reviewsCount' => 398,
            ],
        ]);

        $this->assertSame('Hatimaki', $organization->name);
        $this->assertSame(4.5, (float) $organization->average_rating);
        $this->assertSame(780, $organization->ratings_count);
        $this->assertSame(398, $organization->reviews_count);
    }
}

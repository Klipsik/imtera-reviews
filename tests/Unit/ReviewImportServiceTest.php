<?php

namespace Tests\Unit;

use App\Models\Organization;
use App\Models\Review;
use App\Models\User;
use App\Services\Review\ReviewImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReviewImportServiceTest extends TestCase
{
    use RefreshDatabase;

    private ReviewImportService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(ReviewImportService::class);
    }

    public function test_upsert_batch_deduplicates_same_review_with_different_iso_timestamps(): void
    {
        $organization = Organization::factory()->create([
            'user_id' => User::factory()->create()->id,
        ]);

        $this->service->upsertBatch($organization, [
            [
                'author' => 'Гость',
                'date' => '2024-01-11T16:35:52.043Z',
                'text' => 'Самые вкусные роллы',
                'rating' => 5,
            ],
            [
                'author' => 'Гость',
                'date' => '2024-01-11T22:00:00.000Z',
                'text' => 'Самые вкусные роллы',
                'rating' => 5,
            ],
        ]);

        $this->assertSame(1, Review::where('organization_id', $organization->id)->count());
        $this->assertDatabaseHas('reviews', [
            'organization_id' => $organization->id,
            'yandex_review_id' => 'гость|2024-01-11',
            'author_name' => 'Гость',
        ]);
    }

    public function test_upsert_batch_normalizes_author_whitespace_and_case(): void
    {
        $organization = Organization::factory()->create([
            'user_id' => User::factory()->create()->id,
        ]);

        $this->service->upsertBatch($organization, [
            [
                'author' => '  Ivan  ',
                'date' => '2024-03-15T10:00:00+03:00',
                'text' => 'First import',
                'rating' => 5,
            ],
        ]);

        $this->service->upsertBatch($organization, [
            [
                'author' => 'IVAN',
                'date' => '2024-03-15T18:00:00.000Z',
                'text' => 'Updated text',
                'rating' => 4,
            ],
        ]);

        $this->assertSame(1, Review::where('organization_id', $organization->id)->count());

        $review = Review::where('organization_id', $organization->id)->first();

        $this->assertSame('ivan|2024-03-15', $review->yandex_review_id);
        $this->assertSame('Updated text', $review->text);
        $this->assertSame('4.0', $review->rating);
    }

    public function test_upsert_batch_uses_real_yandex_review_id_when_provided(): void
    {
        $organization = Organization::factory()->create([
            'user_id' => User::factory()->create()->id,
        ]);

        $this->service->upsertBatch($organization, [
            [
                'yandex_review_id' => 'IQ0AdwIX1p9E4kZyf_vonf-8cmlVmtOq',
                'author' => 'Виктория',
                'date' => '2025-12-08T05:30:32.142Z',
                'text' => 'Отличные роллы',
                'rating' => 5,
                'raw_data' => ['reviewId' => 'IQ0AdwIX1p9E4kZyf_vonf-8cmlVmtOq'],
            ],
        ]);

        $this->assertDatabaseHas('reviews', [
            'organization_id' => $organization->id,
            'yandex_review_id' => 'IQ0AdwIX1p9E4kZyf_vonf-8cmlVmtOq',
            'author_name' => 'Виктория',
        ]);
    }

    public function test_upsert_batch_saves_anonymous_reviews_with_yandex_review_id(): void
    {
        $organization = Organization::factory()->create([
            'user_id' => User::factory()->create()->id,
        ]);

        $this->service->upsertBatch($organization, [
            [
                'yandex_review_id' => 'OsNs-D-33ZB1s9SYl0pQd79zaVosm0',
                'author' => '',
                'date' => '2019-10-15T06:20:41.738Z',
                'text' => 'Замечательное кафе',
                'rating' => 5,
            ],
        ]);

        $this->assertDatabaseHas('reviews', [
            'organization_id' => $organization->id,
            'yandex_review_id' => 'OsNs-D-33ZB1s9SYl0pQd79zaVosm0',
            'author_name' => 'Анонимный отзыв',
        ]);
    }
}

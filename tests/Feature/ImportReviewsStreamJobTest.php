<?php

namespace Tests\Feature;

use App\Enums\OrganizationSyncStatus;
use App\Events\ImportCompleted;
use App\Events\ImportFailed;
use App\Events\ReviewsAppended;
use App\Jobs\ImportReviewsStreamJob;
use App\Models\Organization;
use App\Models\Review;
use App\Models\User;
use App\Services\YandexMaps\YandexMapsParserInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class ImportReviewsStreamJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_job_upserts_reviews_and_broadcasts_events(): void
    {
        Event::fake([ReviewsAppended::class, ImportCompleted::class]);

        $user = User::factory()->create();

        $organization = Organization::factory()->create([
            'user_id' => $user->id,
            'sync_status' => OrganizationSyncStatus::Pending->value,
            'reviews_count' => 2,
        ]);

        $parser = $this->createMock(YandexMapsParserInterface::class);

        $parser->method('parseOrganization')->willReturn([
            'org_id' => '12345',
            'name' => 'Test Org',
            'average_rating' => 4.5,
            'ratings_count' => 10,
            'reviews_count' => 2,
            'address' => 'Test address',
            'phone' => '+7',
            'city' => 'Москва',
            'category' => 'Кафе',
            'raw_data' => [],
        ]);

        $parser->method('streamReviews')->willReturn((function () {
            yield [
                'type' => 'batch',
                'reviews' => [
                    [
                        'author' => 'Ivan',
                        'date' => '1 января 2024',
                        'text' => 'Отлично',
                        'rating' => 5,
                    ],
                ],
            ];
            yield ['type' => 'done', 'total' => 1];
        })());

        $this->app->instance(YandexMapsParserInterface::class, $parser);

        $runId = (string) Str::uuid();
        $organization->update(['sync_progress' => ['import_run_id' => $runId]]);

        $job = new ImportReviewsStreamJob(
            $organization->id,
            'https://yandex.ru/maps/org/test/12345/',
            'https://yandex.ru/maps/org/test/12345/reviews/',
            $runId,
        );

        $job->handle(
            app(YandexMapsParserInterface::class),
            app(\App\Services\Organization\OrganizationMetadataService::class),
            app(\App\Services\Review\ReviewImportService::class),
            app(\App\Services\Organization\OrganizationImportRunService::class),
        );

        $organization->refresh();

        $this->assertSame(OrganizationSyncStatus::Completed->value, $organization->sync_status);
        $this->assertSame('Test Org', $organization->name);
        $this->assertDatabaseHas('reviews', [
            'organization_id' => $organization->id,
            'author_name' => 'Ivan',
            'yandex_review_id' => 'ivan|2024-01-01',
            'review_date' => '2024-01-01 00:00:00',
        ]);

        Event::assertDispatched(ReviewsAppended::class);
        Event::assertDispatched(ImportCompleted::class);
    }

    public function test_import_job_marks_organization_failed_on_parser_error(): void
    {
        Event::fake([ImportFailed::class]);

        $user = User::factory()->create();

        $organization = Organization::factory()->create([
            'user_id' => $user->id,
            'sync_status' => OrganizationSyncStatus::Pending->value,
        ]);

        $parser = $this->createMock(YandexMapsParserInterface::class);
        $parser->method('parseOrganization')->willThrowException(new \RuntimeException('Parser unavailable'));

        $this->app->instance(YandexMapsParserInterface::class, $parser);

        $runId = (string) Str::uuid();
        $organization->update(['sync_progress' => ['import_run_id' => $runId]]);

        $job = new ImportReviewsStreamJob(
            $organization->id,
            'https://yandex.ru/maps/org/test/12345/',
            'https://yandex.ru/maps/org/test/12345/reviews/',
            $runId,
        );

        $job->handle(
            app(YandexMapsParserInterface::class),
            app(\App\Services\Organization\OrganizationMetadataService::class),
            app(\App\Services\Review\ReviewImportService::class),
            app(\App\Services\Organization\OrganizationImportRunService::class),
        );

        $organization->refresh();

        $this->assertSame(OrganizationSyncStatus::Failed->value, $organization->sync_status);
        Event::assertDispatched(ImportFailed::class);
    }

    public function test_import_job_failed_callback_marks_organization_failed(): void
    {
        Event::fake([ImportFailed::class]);

        $user = User::factory()->create();

        $organization = Organization::factory()->create([
            'user_id' => $user->id,
            'sync_status' => OrganizationSyncStatus::ParsingReviews->value,
            'sync_progress' => [
                'import_run_id' => $runId = (string) Str::uuid(),
            ],
        ]);

        $job = new ImportReviewsStreamJob(
            $organization->id,
            'https://yandex.ru/maps/org/test/12345/',
            'https://yandex.ru/maps/org/test/12345/reviews/',
            $runId,
        );

        $job->failed(new \RuntimeException('Job timed out'));

        $organization->refresh();

        $this->assertSame(OrganizationSyncStatus::Failed->value, $organization->sync_status);
        Event::assertDispatched(ImportFailed::class);
    }

    public function test_queue_retry_after_exceeds_import_job_timeout(): void
    {
        $job = new ImportReviewsStreamJob(1, 'https://example.com', 'https://example.com/reviews/', (string) Str::uuid());

        $this->assertGreaterThan(
            $job->timeout,
            config('queue.connections.redis.retry_after'),
        );
    }

    public function test_organization_import_dispatches_stream_job(): void
    {
        Queue::fake();

        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/test/12345/',
        ])->assertCreated();

        Queue::assertPushed(ImportReviewsStreamJob::class);
    }

    public function test_organization_import_returns_conflict_when_already_exists(): void
    {
        Queue::fake();

        $user = User::factory()->create();

        Organization::factory()->create([
            'user_id' => $user->id,
            'yandex_org_id' => '199612008855',
            'slug' => '199612008855-26acdd55',
            'name' => 'Hatimaki',
        ]);

        $this->actingAs($user)->postJson('/api/organizations', [
            'url' => 'https://yandex.ru/maps/org/hatimaki/199612008855/',
        ])->assertStatus(409)
            ->assertJsonPath('code', 'organization_exists')
            ->assertJsonPath('organization.name', 'Hatimaki');

        Queue::assertNothingPushed();
    }

    public function test_import_job_completes_when_stream_ends_after_enough_reviews_saved(): void
    {
        Event::fake([ImportCompleted::class, ImportFailed::class]);

        $user = User::factory()->create();

        $organization = Organization::factory()->create([
            'user_id' => $user->id,
            'sync_status' => OrganizationSyncStatus::Pending->value,
            'reviews_count' => 632,
        ]);

        $parser = $this->createMock(YandexMapsParserInterface::class);

        $parser->method('parseOrganization')->willReturn([
            'org_id' => '12345',
            'name' => 'Test Org',
            'average_rating' => 4.5,
            'ratings_count' => 700,
            'reviews_count' => 632,
            'address' => 'Test address',
            'phone' => '+7',
            'city' => 'Москва',
            'category' => 'Кафе',
            'raw_data' => [],
        ]);

        $parser->method('streamReviews')->willReturn((function () {
            yield [
                'type' => 'batch',
                'reviews' => array_map(static fn (int $index) => [
                    'author' => "Author {$index}",
                    'date' => '2024-01-01T10:00:00.000Z',
                    'text' => "Review {$index}",
                    'rating' => 5,
                ], range(1, 600)),
            ];

            throw new \RuntimeException('Unable to read from stream');
        })());

        $this->app->instance(YandexMapsParserInterface::class, $parser);

        $runId = (string) Str::uuid();
        $organization->update(['sync_progress' => ['import_run_id' => $runId]]);

        $job = new ImportReviewsStreamJob(
            $organization->id,
            'https://yandex.ru/maps/org/test/12345/',
            'https://yandex.ru/maps/org/test/12345/reviews/',
            $runId,
        );

        $job->handle(
            app(YandexMapsParserInterface::class),
            app(\App\Services\Organization\OrganizationMetadataService::class),
            app(\App\Services\Review\ReviewImportService::class),
            app(\App\Services\Organization\OrganizationImportRunService::class),
        );

        $organization->refresh();

        $this->assertSame(OrganizationSyncStatus::Completed->value, $organization->sync_status);
        $this->assertSame('completed', $organization->sync_progress['phase']);
        $this->assertSame(600, Review::where('organization_id', $organization->id)->count());
        Event::assertDispatched(ImportCompleted::class);
        Event::assertNotDispatched(ImportFailed::class);
    }

    public function test_import_job_marks_failed_when_too_few_reviews_saved(): void
    {
        Event::fake([ImportFailed::class, ImportCompleted::class]);

        $user = User::factory()->create();

        $organization = Organization::factory()->create([
            'user_id' => $user->id,
            'sync_status' => OrganizationSyncStatus::Pending->value,
            'reviews_count' => 632,
        ]);

        $parser = $this->createMock(YandexMapsParserInterface::class);

        $parser->method('parseOrganization')->willReturn([
            'org_id' => '12345',
            'name' => 'Test Org',
            'average_rating' => 4.5,
            'ratings_count' => 700,
            'reviews_count' => 632,
            'address' => 'Test address',
            'phone' => '+7',
            'city' => 'Москва',
            'category' => 'Кафе',
            'raw_data' => [],
        ]);

        $parser->method('streamReviews')->willReturn((function () {
            yield [
                'type' => 'batch',
                'reviews' => [
                    [
                        'author' => 'Ivan',
                        'date' => '2024-01-01T10:00:00.000Z',
                        'text' => 'Only one',
                        'rating' => 5,
                    ],
                ],
            ];
            yield ['type' => 'done', 'total' => 100];
        })());

        $this->app->instance(YandexMapsParserInterface::class, $parser);

        $runId = (string) Str::uuid();
        $organization->update(['sync_progress' => ['import_run_id' => $runId]]);

        $job = new ImportReviewsStreamJob(
            $organization->id,
            'https://yandex.ru/maps/org/test/12345/',
            'https://yandex.ru/maps/org/test/12345/reviews/',
            $runId,
        );

        $job->handle(
            app(YandexMapsParserInterface::class),
            app(\App\Services\Organization\OrganizationMetadataService::class),
            app(\App\Services\Review\ReviewImportService::class),
            app(\App\Services\Organization\OrganizationImportRunService::class),
        );

        $organization->refresh();

        $this->assertSame(OrganizationSyncStatus::Failed->value, $organization->sync_status);
        Event::assertDispatched(ImportFailed::class);
        Event::assertNotDispatched(ImportCompleted::class);
    }

    public function test_import_job_trims_reviews_above_yandex_reviews_count(): void
    {
        Event::fake([ReviewsAppended::class, ImportCompleted::class]);

        $user = User::factory()->create();

        $organization = Organization::factory()->create([
            'user_id' => $user->id,
            'sync_status' => OrganizationSyncStatus::Pending->value,
            'reviews_count' => 2,
        ]);

        $parser = $this->createMock(YandexMapsParserInterface::class);

        $parser->method('parseOrganization')->willReturn([
            'org_id' => '12345',
            'name' => 'Test Org',
            'average_rating' => 4.5,
            'ratings_count' => 10,
            'reviews_count' => 2,
            'address' => 'Test address',
            'phone' => '+7',
            'city' => 'Москва',
            'category' => 'Кафе',
            'raw_data' => [],
        ]);

        $parser->method('streamReviews')->willReturn((function () {
            yield [
                'type' => 'batch',
                'reviews' => [
                    [
                        'author' => 'Ivan',
                        'date' => '2024-01-01T10:00:00.000Z',
                        'text' => 'First',
                        'rating' => 5,
                    ],
                    [
                        'author' => 'Petr',
                        'date' => '2024-01-02T10:00:00.000Z',
                        'text' => 'Second',
                        'rating' => 4,
                    ],
                    [
                        'author' => 'Olga',
                        'date' => '2024-01-03T10:00:00.000Z',
                        'text' => 'Extra',
                        'rating' => 3,
                    ],
                ],
            ];
            yield ['type' => 'done', 'total' => 3];
        })());

        $this->app->instance(YandexMapsParserInterface::class, $parser);

        $runId = (string) Str::uuid();
        $organization->update(['sync_progress' => ['import_run_id' => $runId]]);

        $job = new ImportReviewsStreamJob(
            $organization->id,
            'https://yandex.ru/maps/org/test/12345/',
            'https://yandex.ru/maps/org/test/12345/reviews/',
            $runId,
        );

        $job->handle(
            app(YandexMapsParserInterface::class),
            app(\App\Services\Organization\OrganizationMetadataService::class),
            app(\App\Services\Review\ReviewImportService::class),
            app(\App\Services\Organization\OrganizationImportRunService::class),
        );

        $organization->refresh();

        $this->assertSame(2, Review::where('organization_id', $organization->id)->count());
        $this->assertSame(2, $organization->sync_progress['saved']);
        $this->assertDatabaseMissing('reviews', [
            'organization_id' => $organization->id,
            'author_name' => 'Olga',
        ]);
    }

    public function test_import_job_stops_when_superseded_by_new_run(): void
    {
        Event::fake([ImportCompleted::class, ImportFailed::class, ReviewsAppended::class]);

        $user = User::factory()->create();

        $organization = Organization::factory()->create([
            'user_id' => $user->id,
            'sync_status' => OrganizationSyncStatus::Pending->value,
            'reviews_count' => 1,
            'sync_progress' => [
                'import_run_id' => (string) Str::uuid(),
            ],
        ]);

        $parser = $this->createMock(YandexMapsParserInterface::class);

        $parser->method('parseOrganization')->willReturn([
            'org_id' => '12345',
            'name' => 'Test Org',
            'average_rating' => 4.5,
            'ratings_count' => 10,
            'reviews_count' => 1,
            'address' => null,
            'phone' => null,
            'city' => null,
            'category' => null,
            'raw_data' => [],
        ]);

        $parser->method('streamReviews')->willReturn((function () {
            yield [
                'type' => 'batch',
                'reviews' => [
                    [
                        'author' => 'Ivan',
                        'date' => '2024-01-01T10:00:00.000Z',
                        'text' => 'Test',
                        'rating' => 5,
                    ],
                ],
            ];
            yield ['type' => 'done', 'total' => 1];
        })());

        $this->app->instance(YandexMapsParserInterface::class, $parser);

        $job = new ImportReviewsStreamJob(
            $organization->id,
            'https://yandex.ru/maps/org/test/12345/',
            'https://yandex.ru/maps/org/test/12345/reviews/',
            (string) Str::uuid(),
        );

        $job->handle(
            app(YandexMapsParserInterface::class),
            app(\App\Services\Organization\OrganizationMetadataService::class),
            app(\App\Services\Review\ReviewImportService::class),
            app(\App\Services\Organization\OrganizationImportRunService::class),
        );

        $organization->refresh();

        $this->assertSame(OrganizationSyncStatus::Pending->value, $organization->sync_status);
        $this->assertSame(0, Review::where('organization_id', $organization->id)->count());
        Event::assertNotDispatched(ImportCompleted::class);
    }
}

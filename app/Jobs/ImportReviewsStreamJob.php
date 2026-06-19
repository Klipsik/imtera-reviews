<?php

namespace App\Jobs;

use App\Enums\OrganizationSyncStatus;
use App\Events\ImportCompleted;
use App\Events\ImportFailed;
use App\Events\ImportPhaseChanged;
use App\Events\OrganizationReady;
use App\Events\ReviewsAppended;
use App\Models\Organization;
use App\Models\Review;
use App\Services\Organization\OrganizationImportRunService;
use App\Services\Organization\OrganizationMetadataService;
use App\Services\Review\ReviewImportService;
use App\Services\YandexMaps\YandexMapsParserInterface;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ImportReviewsStreamJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $timeout = 900;

    public int $tries = 1;

    public bool $failOnTimeout = true;

    public int $uniqueFor = 900;

    public function __construct(
        public int $organizationId,
        public string $canonicalUrl,
        public string $reviewsUrl,
        public string $importRunId,
    ) {}

    public function uniqueId(): string
    {
        return (string) $this->organizationId;
    }

    public function handle(
        YandexMapsParserInterface $parser,
        OrganizationMetadataService $metadataService,
        ReviewImportService $reviewImportService,
        OrganizationImportRunService $importRunService,
    ): void {
        $organization = Organization::find($this->organizationId);

        if (! $organization || ! $importRunService->isActiveRun($organization, $this->importRunId)) {
            return;
        }

        $this->setPhase($organization, OrganizationSyncStatus::ParsingOrg, 'parsing_org', 'Загружаем карточку организации');

        try {
            $orgData = $parser->parseOrganization($this->canonicalUrl);
        } catch (Throwable $e) {
            $this->failImport($organization, $e->getMessage());

            return;
        }

        $organization = Organization::find($this->organizationId);

        if (! $organization) {
            return;
        }

        $organization = $metadataService->applyParserData($organization, $orgData);

        $this->setPhase($organization, OrganizationSyncStatus::ParsingReviews, 'parsing_reviews', 'Загружаем отзывы');

        Review::where('organization_id', $organization->id)->delete();
        $totalSaved = 0;

        OrganizationReady::dispatch($organization->fresh(['city', 'organizationType']), $totalSaved);

        try {
            foreach ($parser->streamReviews($this->reviewsUrl, (int) $organization->reviews_count) as $chunk) {
                $organization = Organization::find($this->organizationId);

                if (! $organization || ! $importRunService->isActiveRun($organization, $this->importRunId)) {
                    return;
                }

                if (($chunk['type'] ?? '') === 'done') {
                    break;
                }

                if (($chunk['type'] ?? '') === 'progress') {
                    $collected = (int) ($chunk['collected'] ?? 0);
                    $expected = (int) ($chunk['expected'] ?? $organization->reviews_count);

                    $this->setPhase(
                        $organization,
                        OrganizationSyncStatus::ParsingReviews,
                        'parsing_reviews',
                        $expected > 0
                            ? "Загружаем отзывы ({$collected}/{$expected})"
                            : 'Загружаем отзывы',
                    );

                    continue;
                }

                $reviews = $chunk['reviews'] ?? [];

                if ($reviews === []) {
                    continue;
                }

                $this->setPhase(
                    $organization,
                    OrganizationSyncStatus::Saving,
                    'saving',
                    'Сохраняем отзывы',
                );

                $reviewImportService->upsertBatch($organization, $reviews);
                $totalSaved = Review::where('organization_id', $organization->id)->count();

                $organization->update([
                    'sync_progress' => array_merge($organization->sync_progress ?? [], [
                        'phase' => 'saving',
                        'saved' => $totalSaved,
                        'import_run_id' => $this->importRunId,
                    ]),
                ]);

                ReviewsAppended::dispatch($organization->fresh(), count($reviews), $totalSaved);
            }
        } catch (Throwable $e) {
            $organization = Organization::find($this->organizationId);

            if (! $organization || ! $importRunService->isActiveRun($organization, $this->importRunId)) {
                return;
            }

            $this->failImport($organization, $e->getMessage());

            return;
        }

        $organization = Organization::find($this->organizationId);

        if (! $organization || ! $importRunService->isActiveRun($organization, $this->importRunId)) {
            return;
        }

        $expectedCount = (int) $organization->reviews_count;

        if ($expectedCount > 0 && $totalSaved > $expectedCount) {
            $excessIds = Review::query()
                ->where('organization_id', $organization->id)
                ->orderBy('id')
                ->get(['id'])
                ->slice($expectedCount)
                ->pluck('id');

            if ($excessIds->isNotEmpty()) {
                Review::query()->whereIn('id', $excessIds)->delete();
                $totalSaved = $expectedCount;
            }
        }

        $organization->update([
            'sync_status' => OrganizationSyncStatus::Completed->value,
            'last_synced_at' => now(),
            'sync_progress' => array_merge($organization->sync_progress ?? [], [
                'phase' => 'completed',
                'saved' => $totalSaved,
            ]),
        ]);

        ImportCompleted::dispatch($organization->fresh(), $totalSaved);
    }

    public function failed(?Throwable $exception): void
    {
        $organization = Organization::find($this->organizationId);

        if (! $organization) {
            return;
        }

        $importRunService = app(OrganizationImportRunService::class);

        if (! $importRunService->isActiveRun($organization, $this->importRunId)) {
            return;
        }

        $this->failImport($organization, $exception?->getMessage() ?? 'Ошибка импорта');
    }

    private function setPhase(
        Organization $organization,
        OrganizationSyncStatus $status,
        string $phase,
        ?string $message = null,
    ): void {
        $organization->update([
            'sync_status' => $status->value,
            'sync_progress' => array_merge($organization->sync_progress ?? [], ['phase' => $phase]),
        ]);

        ImportPhaseChanged::dispatch($organization->fresh(), $phase, $message);
    }

    private function failImport(Organization $organization, string $message): void
    {
        $organization->update(['sync_status' => OrganizationSyncStatus::Failed->value]);
        ImportFailed::dispatch($organization->fresh(), $message);
    }
}

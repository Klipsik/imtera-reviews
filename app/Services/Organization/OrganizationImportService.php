<?php

namespace App\Services\Organization;

use App\Enums\OrganizationSyncStatus;
use App\Exceptions\OrganizationAlreadyExistsException;
use App\Jobs\ImportReviewsStreamJob;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Str;

class OrganizationImportService
{
    public function __construct(
        private OrganizationUrlNormalizerService $urlNormalizer,
        private OrganizationImportRunService $importRunService,
    ) {}

    public function import(User $user, string $url): Organization
    {
        if (! $this->urlNormalizer->isValidYandexMapsUrl($url)) {
            throw new \InvalidArgumentException('Некорректная ссылка на Яндекс.Карты');
        }

        $normalized = $this->urlNormalizer->normalize($url);
        $slug = Str::slug($normalized['org_id'].'-'.substr(md5($normalized['canonical_url']), 0, 8));

        $existing = Organization::query()
            ->where('user_id', $user->id)
            ->where(function ($query) use ($normalized, $slug) {
                $query->where('yandex_org_id', $normalized['org_id'])
                    ->orWhere('slug', $slug);
            })
            ->first();

        if ($existing) {
            throw new OrganizationAlreadyExistsException($existing);
        }

        $organization = Organization::create([
            'user_id' => $user->id,
            'yandex_url' => $normalized['input_url'],
            'yandex_org_id' => $normalized['org_id'],
            'name' => 'Загрузка…',
            'slug' => $slug,
            'sync_status' => OrganizationSyncStatus::Pending->value,
            'sync_progress' => ['phase' => 'pending', 'saved' => 0],
        ]);

        $this->dispatchImportJob($organization, $normalized['canonical_url'], $normalized['reviews_url']);

        return $organization;
    }

    public function resync(Organization $organization): Organization
    {
        $normalized = $this->urlNormalizer->normalize($organization->yandex_url);

        $this->importRunService->removePendingJobs($organization->id);

        $runId = (string) Str::uuid();

        $organization->update([
            'sync_status' => OrganizationSyncStatus::Pending->value,
            'sync_progress' => [
                'phase' => 'pending',
                'saved' => 0,
                'import_run_id' => $runId,
            ],
        ]);

        ImportReviewsStreamJob::dispatch(
            $organization->id,
            $normalized['canonical_url'],
            $normalized['reviews_url'],
            $runId,
        );

        return $organization->fresh();
    }

    public function cancelAndDelete(Organization $organization): void
    {
        $this->importRunService->removePendingJobs($organization->id);

        $organization->update([
            'sync_progress' => array_merge($organization->sync_progress ?? [], [
                'import_run_id' => (string) Str::uuid(),
            ]),
        ]);

        $organization->delete();
    }

    private function dispatchImportJob(Organization $organization, string $canonicalUrl, string $reviewsUrl): void
    {
        $runId = $this->importRunService->startRun($organization);

        ImportReviewsStreamJob::dispatch(
            $organization->id,
            $canonicalUrl,
            $reviewsUrl,
            $runId,
        );
    }
}

<?php

namespace App\Services\Organization;

use App\Jobs\ImportReviewsStreamJob;
use App\Models\Organization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrganizationImportRunService
{
    public function startRun(Organization $organization): string
    {
        $runId = (string) Str::uuid();

        $organization->update([
            'sync_progress' => array_merge($organization->sync_progress ?? [], [
                'import_run_id' => $runId,
            ]),
        ]);

        return $runId;
    }

    public function isActiveRun(Organization $organization, string $runId): bool
    {
        $currentRunId = $organization->sync_progress['import_run_id'] ?? null;

        return is_string($currentRunId) && $currentRunId === $runId;
    }

    public function removePendingJobs(int $organizationId): int
    {
        $removed = 0;

        foreach (DB::table('jobs')->orderBy('id')->get() as $job) {
            if (! $this->payloadTargetsOrganization($job->payload, $organizationId)) {
                continue;
            }

            DB::table('jobs')->where('id', $job->id)->delete();
            $removed++;
        }

        return $removed;
    }

    private function payloadTargetsOrganization(string $payload, int $organizationId): bool
    {
        if (! str_contains($payload, ImportReviewsStreamJob::class)) {
            return false;
        }

        return str_contains($payload, '"organizationId";i:'.$organizationId.';')
            || str_contains($payload, '"organizationId";i:'.$organizationId)
            || str_contains($payload, '"organizationId":'.$organizationId);
    }
}

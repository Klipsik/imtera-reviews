<?php

namespace App\Services\Organization;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class OrganizationQueryService
{
    public function __construct(
        private OrganizationAccessService $access,
    ) {}

    public function listForUser(User $user): Collection
    {
        return Organization::query()
            ->where('user_id', $user->id)
            ->with(['city', 'organizationType'])
            ->latest()
            ->get();
    }

    public function getForUser(User $user, Organization $organization): Organization
    {
        $this->access->ensureOwned($user, $organization);

        return $organization->load(['city', 'organizationType']);
    }
}

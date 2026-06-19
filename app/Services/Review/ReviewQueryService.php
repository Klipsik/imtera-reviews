<?php

namespace App\Services\Review;

use App\Models\Organization;
use App\Models\Review;
use App\Models\User;
use App\Services\Organization\OrganizationAccessService;
use Illuminate\Database\Eloquent\Collection;

class ReviewQueryService
{
    public function __construct(
        private OrganizationAccessService $access,
    ) {}

    /**
     * @return Collection<int, Review>
     */
    public function listForOrganization(User $user, Organization $organization): Collection
    {
        $this->access->ensureOwned($user, $organization);

        return $organization->reviews()
            ->orderByDesc('review_date')
            ->get();
    }
}

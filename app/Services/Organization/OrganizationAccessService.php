<?php

namespace App\Services\Organization;

use App\Models\Organization;
use App\Models\User;

class OrganizationAccessService
{
    public function ensureOwned(User $user, Organization $organization): void
    {
        if ($organization->user_id !== $user->id) {
            abort(403, 'Forbidden');
        }
    }
}

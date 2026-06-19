<?php

namespace App\Services\Organization;

use App\Models\City;
use App\Models\Organization;
use App\Models\OrganizationType;

class OrganizationMetadataService
{
    public function applyParserData(Organization $organization, array $data): Organization
    {
        $cityId = null;

        if (! empty($data['city'])) {
            $cityId = City::firstOrCreate(['name' => $data['city']])->id;
        }

        $typeId = null;

        if (! empty($data['category'])) {
            $typeId = OrganizationType::firstOrCreate(['name' => $data['category']])->id;
        }

        $organization->update([
            'name' => $data['name'] ?? $organization->name,
            'yandex_org_id' => $data['org_id'] ?? $organization->yandex_org_id,
            'average_rating' => $data['average_rating'] ?? 0,
            'ratings_count' => $data['ratings_count'] ?? 0,
            'reviews_count' => $data['reviews_count'] ?? 0,
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'city_id' => $cityId,
            'organization_type_id' => $typeId,
            'raw_data' => $data['raw_data'] ?? null,
        ]);

        return $organization->fresh(['city', 'organizationType']);
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'yandex_url' => $this->yandex_url,
            'yandex_org_id' => $this->yandex_org_id,
            'average_rating' => (float) $this->average_rating,
            'ratings_count' => (int) $this->ratings_count,
            'reviews_count' => (int) $this->reviews_count,
            'address' => $this->address,
            'phone' => $this->phone,
            'sync_status' => $this->sync_status,
            'sync_progress' => $this->sync_progress,
            'last_synced_at' => $this->last_synced_at,
            'city' => $this->whenLoaded('city', fn () => $this->city ? [
                'id' => $this->city->id,
                'name' => $this->city->name,
            ] : null),
            'organization_type' => $this->whenLoaded('organizationType', fn () => $this->organizationType ? [
                'id' => $this->organizationType->id,
                'name' => $this->organizationType->name,
            ] : null),
            'created_at' => $this->created_at,
        ];
    }
}

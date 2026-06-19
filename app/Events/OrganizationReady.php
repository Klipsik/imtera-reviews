<?php

namespace App\Events;

use App\Models\Organization;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrganizationReady implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public Organization $organization,
        public int $totalSaved = 0,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('org.'.$this->organization->id)];
    }

    public function broadcastAs(): string
    {
        return 'OrganizationReady';
    }

    public function broadcastWith(): array
    {
        $org = $this->organization->loadMissing(['city', 'organizationType']);

        return [
            'organization_id' => $org->id,
            'name' => $org->name,
            'average_rating' => (float) $org->average_rating,
            'ratings_count' => (int) $org->ratings_count,
            'reviews_count' => (int) $org->reviews_count,
            'total_saved' => $this->totalSaved,
            'address' => $org->address,
            'phone' => $org->phone,
            'yandex_url' => $org->yandex_url,
            'phase' => 'parsing_reviews',
            'city' => $org->city ? ['id' => $org->city->id, 'name' => $org->city->name] : null,
            'organization_type' => $org->organizationType
                ? ['id' => $org->organizationType->id, 'name' => $org->organizationType->name]
                : null,
        ];
    }
}

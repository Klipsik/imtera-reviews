<?php

namespace App\Events;

use App\Models\Organization;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReviewsAppended implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public Organization $organization,
        public int $batchSaved,
        public int $totalSaved,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('org.'.$this->organization->id)];
    }

    public function broadcastAs(): string
    {
        return 'ReviewsAppended';
    }

    public function broadcastWith(): array
    {
        return [
            'organization_id' => $this->organization->id,
            'batch_saved' => $this->batchSaved,
            'total_saved' => $this->totalSaved,
        ];
    }
}

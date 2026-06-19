<?php

namespace App\Events;

use App\Models\Organization;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ImportCompleted implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public Organization $organization,
        public int $totalSaved,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('org.'.$this->organization->id)];
    }

    public function broadcastAs(): string
    {
        return 'ImportCompleted';
    }

    public function broadcastWith(): array
    {
        return [
            'organization_id' => $this->organization->id,
            'total_saved' => $this->totalSaved,
            'sync_status' => $this->organization->sync_status,
        ];
    }
}

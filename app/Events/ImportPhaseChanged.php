<?php

namespace App\Events;

use App\Models\Organization;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ImportPhaseChanged implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(
        public Organization $organization,
        public string $phase,
        public ?string $message = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('org.'.$this->organization->id)];
    }

    public function broadcastAs(): string
    {
        return 'ImportPhaseChanged';
    }

    public function broadcastWith(): array
    {
        return [
            'organization_id' => $this->organization->id,
            'phase' => $this->phase,
            'message' => $this->message,
        ];
    }
}

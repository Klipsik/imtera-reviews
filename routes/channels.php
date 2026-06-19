<?php

use App\Models\Organization;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('org.{organizationId}', function ($user, int $organizationId) {
    return Organization::where('id', $organizationId)
        ->where('user_id', $user->id)
        ->exists();
});

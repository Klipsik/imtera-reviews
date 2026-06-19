<?php

namespace App\Models;

use Database\Factories\OrganizationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    /** @use HasFactory<OrganizationFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'yandex_url',
        'yandex_org_id',
        'name',
        'slug',
        'city_id',
        'organization_type_id',
        'address',
        'phone',
        'average_rating',
        'ratings_count',
        'reviews_count',
        'raw_data',
        'meta',
        'sync_status',
        'sync_progress',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'average_rating' => 'decimal:1',
            'ratings_count' => 'integer',
            'reviews_count' => 'integer',
            'raw_data' => 'array',
            'meta' => 'array',
            'sync_progress' => 'array',
            'last_synced_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function city(): BelongsTo
    {
        return $this->belongsTo(City::class);
    }

    public function organizationType(): BelongsTo
    {
        return $this->belongsTo(OrganizationType::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }
}

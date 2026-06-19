<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    protected $fillable = [
        'organization_id',
        'yandex_review_id',
        'author_name',
        'author_avatar',
        'review_date',
        'text',
        'rating',
        'raw_data',
    ];

    protected function casts(): array
    {
        return [
            'review_date' => 'datetime',
            'rating' => 'decimal:1',
            'raw_data' => 'array',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}

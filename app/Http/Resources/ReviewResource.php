<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'author_name' => $this->author_name,
            'author_avatar' => $this->author_avatar,
            'review_date' => $this->review_date,
            'text' => $this->text,
            'rating' => $this->rating !== null ? (float) $this->rating : null,
            'yandex_review_id' => $this->yandex_review_id,
        ];
    }
}

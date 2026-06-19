<?php

namespace App\Services\Review;

use App\Models\Organization;
use App\Models\Review;
use Carbon\Carbon;

class ReviewImportService
{
    private const ANONYMOUS_REVIEW_AUTHOR = 'Анонимный отзыв';

    public function __construct(
        private YandexReviewDateParser $dateParser,
    ) {}

    /**
     * @param  array<int, array<string, mixed>>  $reviews
     */
    public function upsertBatch(Organization $organization, array $reviews): int
    {
        if ($reviews === []) {
            return 0;
        }

        $rows = [];
        $seenKeys = [];

        foreach ($reviews as $review) {
            $dateRaw = $review['date'] ?? $review['review_date'] ?? null;

            if (! $dateRaw) {
                continue;
            }

            $author = trim((string) ($review['author'] ?? $review['author_name'] ?? ''));

            if ($author === '') {
                $author = self::ANONYMOUS_REVIEW_AUTHOR;
            }

            $reviewDate = $this->parseDate((string) $dateRaw);
            $reviewId = trim((string) ($review['yandex_review_id'] ?? $review['reviewId'] ?? ''));

            if ($reviewId === '') {
                $reviewId = $this->normalizeReviewId($author, $reviewDate);
            }

            if (isset($seenKeys[$reviewId])) {
                continue;
            }

            $seenKeys[$reviewId] = true;

            $rows[] = [
                'organization_id' => $organization->id,
                'yandex_review_id' => $reviewId,
                'author_name' => $author,
                'author_avatar' => $review['avatar'] ?? $review['author_avatar'] ?? null,
                'review_date' => $reviewDate,
                'text' => $review['text'] ?? null,
                'rating' => isset($review['rating']) ? (float) $review['rating'] : null,
                'raw_data' => json_encode($review),
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if ($rows === []) {
            return 0;
        }

        Review::upsert(
            $rows,
            ['organization_id', 'yandex_review_id'],
            ['author_name', 'author_avatar', 'review_date', 'text', 'rating', 'raw_data', 'updated_at'],
        );

        return Review::where('organization_id', $organization->id)->count();
    }

    private function normalizeReviewId(string $author, Carbon $date): string
    {
        return $this->normalizeAuthor($author).'|'.$date->toDateString();
    }

    private function normalizeAuthor(string $author): string
    {
        $normalized = preg_replace('/\s+/u', ' ', trim($author));

        return mb_strtolower($normalized ?? '');
    }

    private function parseDate(string $date): Carbon
    {
        if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $date, $matches) === 1) {
            return Carbon::createFromFormat('Y-m-d', $matches[1])->startOfDay();
        }

        return $this->dateParser->parse($date);
    }
}

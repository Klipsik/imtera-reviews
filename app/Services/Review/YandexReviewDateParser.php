<?php

namespace App\Services\Review;

use Carbon\Carbon;
use InvalidArgumentException;

class YandexReviewDateParser
{
    /** @var array<string, int> */
    private const MONTHS = [
        'января' => 1,
        'февраля' => 2,
        'марта' => 3,
        'апреля' => 4,
        'мая' => 5,
        'июня' => 6,
        'июля' => 7,
        'августа' => 8,
        'сентября' => 9,
        'октября' => 10,
        'ноября' => 11,
        'декабря' => 12,
    ];

    public function parse(string $date): Carbon
    {
        $date = trim($date);

        if ($date === '') {
            throw new InvalidArgumentException('Empty review date');
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $date) === 1) {
            return Carbon::parse($date)->startOfDay();
        }

        $normalized = mb_strtolower($date);

        if ($normalized === 'сегодня') {
            return now()->startOfDay();
        }

        if ($normalized === 'вчера') {
            return now()->subDay()->startOfDay();
        }

        if (preg_match('/^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:\s*г\.?)?$/u', $normalized, $matches) === 1) {
            $day = (int) $matches[1];
            $monthName = $matches[2];
            $year = isset($matches[3]) ? (int) $matches[3] : null;

            if (! isset(self::MONTHS[$monthName])) {
                throw new InvalidArgumentException("Unknown month: {$monthName}");
            }

            $month = self::MONTHS[$monthName];
            $resolvedYear = $this->resolveYear($month, $day, $year);

            return Carbon::create($resolvedYear, $month, $day)->startOfDay();
        }

        return Carbon::parse($date)->startOfDay();
    }

    private function resolveYear(int $month, int $day, ?int $year): int
    {
        if ($year !== null) {
            return $year;
        }

        $candidate = Carbon::create(now()->year, $month, $day)->startOfDay();

        if ($candidate->isFuture()) {
            return now()->year - 1;
        }

        return now()->year;
    }
}

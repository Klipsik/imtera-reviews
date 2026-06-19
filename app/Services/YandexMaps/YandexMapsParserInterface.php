<?php

namespace App\Services\YandexMaps;

interface YandexMapsParserInterface
{
    public function parseOrganization(string $url): array;

    /**
     * @return \Generator<int, array<string, mixed>>
     */
    public function streamReviews(string $reviewsUrl, ?int $expectedTotal = null): \Generator;
}

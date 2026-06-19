<?php

namespace App\Services\YandexMaps;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class YandexMapsParserClient implements YandexMapsParserInterface
{
    private string $baseUrl;

    public function __construct(?string $baseUrl = null)
    {
        $this->baseUrl = rtrim($baseUrl ?: config('services.parser.url', 'http://127.0.0.1:3001'), '/');
    }

    public function parseOrganization(string $url): array
    {
        $response = Http::timeout(120)
            ->post("{$this->baseUrl}/parse/org", ['url' => $url]);

        if (! $response->successful()) {
            Log::warning('Parser org request failed', [
                'url' => $url,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new \RuntimeException('Не удалось получить данные организации');
        }

        $data = $response->json();

        if (isset($data['error'])) {
            throw new \RuntimeException($data['error']);
        }

        return [
            'org_id' => (string) ($data['org_id'] ?? 'unknown'),
            'name' => $data['name'] ?? 'Unknown',
            'average_rating' => (float) ($data['rating'] ?? 0),
            'ratings_count' => (int) ($data['ratingsCount'] ?? 0),
            'reviews_count' => (int) ($data['reviewsCount'] ?? 0),
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'city' => $data['city'] ?? null,
            'category' => $data['category'] ?? null,
            'raw_data' => $data,
        ];
    }

    public function streamReviews(string $reviewsUrl, ?int $expectedTotal = null): \Generator
    {
        $expectedTotal = $expectedTotal ?? 0;
        $timeout = max(300, min(900, 180 + (int) ceil(max($expectedTotal, 1) / 2) * 3));

        $response = Http::timeout($timeout)
            ->withOptions([
                'stream' => true,
                'read_timeout' => 120,
            ])
            ->post("{$this->baseUrl}/parse/reviews/stream", [
                'url' => $reviewsUrl,
                'expected_total' => $expectedTotal > 0 ? $expectedTotal : null,
            ]);

        if (! $response->successful()) {
            Log::warning('Parser reviews stream failed', [
                'url' => $reviewsUrl,
                'status' => $response->status(),
            ]);

            throw new \RuntimeException('Не удалось получить отзывы с Яндекса');
        }

        $body = $response->toPsrResponse()->getBody();
        $buffer = '';

        while (! $body->eof()) {
            $buffer .= $body->read(8192);

            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);

                if ($line === '') {
                    continue;
                }

                $chunk = json_decode($line, true);

                if (! is_array($chunk)) {
                    continue;
                }

                if (isset($chunk['error'])) {
                    throw new \RuntimeException($chunk['error']);
                }

                yield $chunk;
            }
        }

        $tail = trim($buffer);

        if ($tail !== '') {
            $chunk = json_decode($tail, true);

            if (is_array($chunk)) {
                if (isset($chunk['error'])) {
                    throw new \RuntimeException($chunk['error']);
                }

                yield $chunk;
            }
        }
    }
}

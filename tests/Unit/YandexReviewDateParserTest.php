<?php

namespace Tests\Unit;

use App\Services\Review\YandexReviewDateParser;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class YandexReviewDateParserTest extends TestCase
{
    private YandexReviewDateParser $parser;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-06-19 12:00:00');
        $this->parser = new YandexReviewDateParser;
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    #[DataProvider('russianDatesProvider')]
    public function test_parses_russian_review_dates(string $input, string $expected): void
    {
        $this->assertSame(
            $expected,
            $this->parser->parse($input)->toDateString(),
        );
    }

    public static function russianDatesProvider(): array
    {
        return [
            'full date' => ['18 июня 2024', '2024-06-18'],
            'full date with g dot' => ['1 января 2024 г.', '2024-01-01'],
            'month without year past' => ['18 июня', '2026-06-18'],
            'month without year wraps to previous year' => ['31 декабря', '2025-12-31'],
            'today' => ['сегодня', '2026-06-19'],
            'yesterday' => ['вчера', '2026-06-18'],
            'iso date' => ['2024-03-15T10:00:00+03:00', '2024-03-15'],
        ];
    }
}

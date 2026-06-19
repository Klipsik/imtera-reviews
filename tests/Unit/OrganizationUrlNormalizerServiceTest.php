<?php

namespace Tests\Unit;

use App\Services\Organization\OrganizationUrlNormalizerService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OrganizationUrlNormalizerServiceTest extends TestCase
{
    #[Test]
    public function it_extracts_org_id_from_canonical_url(): void
    {
        $service = new OrganizationUrlNormalizerService;

        $result = $service->normalize('https://yandex.ru/maps/org/kafe/123456789012/');

        $this->assertSame('123456789012', $result['org_id']);
        $this->assertStringContainsString('/reviews/', $result['reviews_url']);
    }

    #[Test]
    public function it_validates_yandex_maps_urls(): void
    {
        $service = new OrganizationUrlNormalizerService;

        $this->assertTrue($service->isValidYandexMapsUrl('https://yandex.ru/maps/org/test/1/'));
        $this->assertFalse($service->isValidYandexMapsUrl('https://google.com/maps'));
    }
}

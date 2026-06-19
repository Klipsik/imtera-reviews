<?php

namespace App\Services\Organization;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class OrganizationUrlNormalizerService
{
    /**
     * @return array{org_id: string, canonical_url: string, reviews_url: string, input_url: string}
     */
    public function normalize(string $url): array
    {
        $url = trim($url);

        if (! str_starts_with($url, 'http')) {
            throw new \InvalidArgumentException('URL must start with http or https');
        }

        $resolved = $this->resolveUrl($url);
        $orgId = $this->extractOrgId($resolved);

        if (! $orgId) {
            throw new \InvalidArgumentException('Could not extract organization ID from URL');
        }

        $slug = $this->extractSlug($resolved);
        $canonical = $slug
            ? "https://yandex.ru/maps/org/{$slug}/{$orgId}/"
            : "https://yandex.ru/maps/org/x/{$orgId}/";

        return [
            'org_id' => $orgId,
            'canonical_url' => $canonical,
            'reviews_url' => rtrim($canonical, '/').'/reviews/',
            'input_url' => $url,
        ];
    }

    public function extractOrgId(string $url): ?string
    {
        if (preg_match('/\/org\/[^\/]+\/(\d+)/', $url, $matches)) {
            return $matches[1];
        }

        if (preg_match('/poi(?:%5Buri%5D|\[uri\])=ymapsbm1[^&]*oid(?:%3D|=)(\d+)/', $url, $matches)) {
            return $matches[1];
        }

        if (preg_match('/oid[=:](\d+)/', $url, $matches)) {
            return $matches[1];
        }

        return null;
    }

    public function isValidYandexMapsUrl(string $url): bool
    {
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        $host = parse_url($url, PHP_URL_HOST) ?? '';

        return Str::contains($host, 'yandex.') && Str::contains($url, 'maps');
    }

    private function extractSlug(string $url): ?string
    {
        if (preg_match('/\/org\/([^\/]+)\/\d+/', $url, $matches)) {
            return $matches[1];
        }

        return null;
    }

    private function resolveUrl(string $url): string
    {
        $needsResolve = str_contains($url, '/-/')
            || str_contains($url, 'poi%5Buri%5D')
            || str_contains($url, 'poi[uri]')
            || ! $this->extractOrgId($url);

        if (! $needsResolve) {
            return $this->stripTabPath($url);
        }

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ])->withOptions([
                'allow_redirects' => true,
            ])->head($url);

            return $this->stripTabPath((string) $response->effectiveUri());
        } catch (\Throwable) {
            return $this->stripTabPath($url);
        }
    }

    private function stripTabPath(string $url): string
    {
        $url = preg_replace('#/(menu|reviews|prices|photos|posts)/?(\?.*)?$#', '/', $url) ?? $url;
        $url = preg_replace('#[?&]tab=[^&]+#', '', $url) ?? $url;

        return rtrim($url, '/').'/';
    }
}

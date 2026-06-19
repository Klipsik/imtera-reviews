<?php

namespace App\Providers;

use App\Services\YandexMaps\YandexMapsParserClient;
use App\Services\YandexMaps\YandexMapsParserInterface;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(YandexMapsParserInterface::class, YandexMapsParserClient::class);
    }

    public function boot(): void
    {
        Broadcast::routes(['middleware' => ['web', 'auth:sanctum']]);
    }
}

<?php

namespace App\Http\Requests;

use App\Services\Organization\OrganizationUrlNormalizerService;
use Illuminate\Foundation\Http\FormRequest;

class StoreOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'url' => ['required', 'string', 'url', function ($attribute, $value, $fail) {
                if (! app(OrganizationUrlNormalizerService::class)->isValidYandexMapsUrl($value)) {
                    $fail('Укажите ссылку на организацию в Яндекс.Картах');
                }
            }],
        ];
    }
}

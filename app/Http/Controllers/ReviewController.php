<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReviewResource;
use App\Models\Organization;
use App\Services\Review\ReviewQueryService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReviewController extends Controller
{
    public function __construct(
        private ReviewQueryService $queryService,
    ) {}

    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        return ReviewResource::collection(
            $this->queryService->listForOrganization($request->user(), $organization),
        );
    }
}

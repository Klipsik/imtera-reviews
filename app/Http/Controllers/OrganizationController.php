<?php

namespace App\Http\Controllers;

use App\Exceptions\OrganizationAlreadyExistsException;
use App\Http\Requests\StoreOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Models\Organization;
use App\Services\Organization\OrganizationImportService;
use App\Services\Organization\OrganizationQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizationController extends Controller
{
    public function __construct(
        private OrganizationImportService $importService,
        private OrganizationQueryService $queryService,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return OrganizationResource::collection(
            $this->queryService->listForUser($request->user()),
        );
    }

    public function store(StoreOrganizationRequest $request): JsonResponse
    {
        try {
            $organization = $this->importService->import(
                $request->user(),
                $request->validated('url'),
            );
        } catch (OrganizationAlreadyExistsException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'organization_exists',
                'organization' => new OrganizationResource(
                    $e->organization->load(['city', 'organizationType']),
                ),
            ], 409);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return (new OrganizationResource($organization->load(['city', 'organizationType'])))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Organization $organization): OrganizationResource
    {
        return new OrganizationResource(
            $this->queryService->getForUser($request->user(), $organization),
        );
    }

    public function resync(Request $request, Organization $organization): OrganizationResource
    {
        $organization = $this->importService->resync(
            $this->queryService->getForUser($request->user(), $organization),
        );

        return new OrganizationResource($organization->load(['city', 'organizationType']));
    }

    public function destroy(Request $request, Organization $organization): JsonResponse
    {
        $this->importService->cancelAndDelete(
            $this->queryService->getForUser($request->user(), $organization),
        );

        return response()->json(['message' => 'OK']);
    }
}

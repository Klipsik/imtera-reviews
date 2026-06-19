<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\ReviewController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/organizations', [OrganizationController::class, 'index']);
    Route::post('/organizations', [OrganizationController::class, 'store']);
    Route::get('/organizations/{organization}', [OrganizationController::class, 'show']);
    Route::post('/organizations/{organization}/resync', [OrganizationController::class, 'resync']);
    Route::delete('/organizations/{organization}', [OrganizationController::class, 'destroy']);
    Route::get('/organizations/{organization}/reviews', [ReviewController::class, 'index']);
});

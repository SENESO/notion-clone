<?php

use Slim\App;
use App\Controllers\AuthController;
use App\Controllers\PageController;
use App\Controllers\BlockController;
use App\Controllers\UserController;
use App\Controllers\WorkspaceController;
use App\Controllers\FileController;
use App\Controllers\SearchController;
use App\Controllers\DatabaseBlockController;

/** @var App $app */

// API routes group
$app->group('/api', function ($group) {
    // Auth routes
    $group->group('/auth', function ($group) {
        $group->post('/register', [AuthController::class, 'register']);
        $group->post('/login', [AuthController::class, 'login']);
        $group->post('/refresh', [AuthController::class, 'refresh']);
        $group->post('/logout', [AuthController::class, 'logout']);
    });

    // User routes
    $group->group('/users', function ($group) {
        $group->get('', [UserController::class, 'getAll']);
        $group->get('/me', [UserController::class, 'getMe']);
        $group->get('/{id}', [UserController::class, 'getById']);
        $group->put('/{id}', [UserController::class, 'update']);
        $group->delete('/{id}', [UserController::class, 'delete']);
    });

    // Workspace routes
    $group->group('/workspaces', function ($group) {
        $group->get('', [WorkspaceController::class, 'getAll']);
        $group->post('', [WorkspaceController::class, 'create']);
        $group->get('/{id}', [WorkspaceController::class, 'getById']);
        $group->put('/{id}', [WorkspaceController::class, 'update']);
        $group->delete('/{id}', [WorkspaceController::class, 'delete']);
    });

    // Page routes
    $group->group('/pages', function ($group) {
        $group->get('', [PageController::class, 'getAll']);
        $group->post('', [PageController::class, 'create']);
        $group->get('/{id}', [PageController::class, 'getById']);
        $group->put('/{id}', [PageController::class, 'update']);
        $group->delete('/{id}', [PageController::class, 'delete']);
        $group->get('/{id}/blocks', [PageController::class, 'getBlocks']);
    });

    // Block routes
    $group->group('/blocks', function ($group) {
        $group->get('/{id}', [BlockController::class, 'getById']);
        $group->post('', [BlockController::class, 'create']);
        $group->put('/{id}', [BlockController::class, 'update']);
        $group->delete('/{id}', [BlockController::class, 'delete']);
        $group->post('/{id}/children', [BlockController::class, 'createChildren']);
    });

    // Database block routes
    $group->group('/database-blocks', function ($group) {
        $group->post('/table', [DatabaseBlockController::class, 'createTable']);
        $group->post('/kanban', [DatabaseBlockController::class, 'createKanban']);
        $group->post('/calendar', [DatabaseBlockController::class, 'createCalendar']);
    });

    // File uploads
    $group->group('/files', function ($group) {
        $group->post('/upload', [FileController::class, 'upload']);
        $group->get('/{id}', [FileController::class, 'getById']);
        $group->get('/{id}/thumbnail', [FileController::class, 'getById']);
        $group->delete('/{id}', [FileController::class, 'delete']);
    });

    // Search
    $group->group('/search', function ($group) {
        $group->post('', [SearchController::class, 'search']);
    });
});

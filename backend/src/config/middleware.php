<?php

use Slim\App;
use Tuupola\Middleware\JwtAuthentication;

/** @var App $app */

// CORS middleware
$app->add(function ($request, $handler) {
    $response = $handler->handle($request);
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

// Add options method handling for CORS preflight requests
$app->options('/{routes:.+}', function ($request, $response) {
    return $response;
});

// Parse JSON body
$app->addBodyParsingMiddleware();

// JWT Authentication middleware
$app->add(new JwtAuthentication([
    'path' => '/api',
    'ignore' => ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'],
    'secret' => $_ENV['JWT_SECRET'],
    'algorithm' => ['HS256'],
    'error' => function ($response, $arguments) {
        $data = [
            'status' => 'error',
            'message' => $arguments['message']
        ];
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus(401);
    }
]));

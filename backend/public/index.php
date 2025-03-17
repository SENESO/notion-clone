<?php
require __DIR__ . '/../vendor/autoload.php';

use DI\ContainerBuilder;
use Slim\Factory\AppFactory;
use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

// Set up dependency injection container
$containerBuilder = new ContainerBuilder();
$containerBuilder->addDefinitions(__DIR__ . '/../src/config/container.php');
$container = $containerBuilder->build();

// Create app
$app = AppFactory::createFromContainer($container);

// Add error middleware
$errorMiddleware = $app->addErrorMiddleware(
    $_ENV['APP_DEBUG'] === 'true',
    true,
    true
);

// Add middleware
require __DIR__ . '/../src/config/middleware.php';

// Register routes
require __DIR__ . '/../src/routes/api.php';

// Run app
$app->run();

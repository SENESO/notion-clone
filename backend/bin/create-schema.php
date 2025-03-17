<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Doctrine\ORM\Tools\SchemaTool;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\Tools\Setup;
use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->load();

// Set up Doctrine ORM
$isDevMode = $_ENV['APP_ENV'] === 'development';
$paths = [__DIR__ . '/../src/models/entities'];
$dbParams = [
    'driver'   => 'pdo_pgsql',
    'host'     => $_ENV['DB_HOST'],
    'port'     => $_ENV['DB_PORT'],
    'dbname'   => $_ENV['DB_NAME'],
    'user'     => $_ENV['DB_USER'],
    'password' => $_ENV['DB_PASS'],
    'charset'  => 'utf8'
];

$config = Setup::createAnnotationMetadataConfiguration(
    $paths,
    $isDevMode,
    null,
    null,
    false
);

try {
    $entityManager = EntityManager::create($dbParams, $config);

    // Get a list of all entity classes
    $metadataFactory = $entityManager->getMetadataFactory();
    $classes = $metadataFactory->getAllMetadata();

    // Create schema tool
    $schemaTool = new SchemaTool($entityManager);

    // Create database schema
    $schemaTool->createSchema($classes);

    echo "✅ Database schema created successfully!" . PHP_EOL;
} catch (Exception $e) {
    echo "❌ Error creating database schema: " . $e->getMessage() . PHP_EOL;
    exit(1);
}

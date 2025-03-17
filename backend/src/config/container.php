<?php

use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\Tools\Setup;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use GuzzleHttp\Client;

return [
    // Database connection
    EntityManager::class => function (ContainerInterface $container) {
        $isDevMode = $_ENV['APP_ENV'] === 'development';

        $paths = [__DIR__ . '/../models/entities'];
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

        return EntityManager::create($dbParams, $config);
    },

    // Logger
    Logger::class => function (ContainerInterface $container) {
        $logger = new Logger('app');
        $logFile = __DIR__ . '/../../logs/app.log';

        // Create logs directory if it doesn't exist
        if (!is_dir(dirname($logFile))) {
            mkdir(dirname($logFile), 0777, true);
        }

        $logger->pushHandler(new StreamHandler($logFile, Logger::DEBUG));
        return $logger;
    },

    // HTTP Client
    Client::class => function (ContainerInterface $container) {
        return new Client();
    },
];

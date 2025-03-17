<?php

require dirname(__DIR__) . '/vendor/autoload.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use App\WebSocket\NotionWebSocketServer;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(dirname(__DIR__));
$dotenv->load();

// Set up logger
$logger = new Logger('websocket');
$logFile = dirname(__DIR__) . '/logs/websocket.log';

// Ensure log directory exists
if (!is_dir(dirname($logFile))) {
    mkdir(dirname($logFile), 0777, true);
}

$logger->pushHandler(new StreamHandler($logFile, Logger::DEBUG));

// WebSocket server port
$port = $_ENV['WEBSOCKET_PORT'] ?? 8080;

$logger->info("Starting WebSocket server on port {$port}");

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new NotionWebSocketServer($logger)
        )
    ),
    $port
);

$logger->info("WebSocket server running on port {$port}");

$server->run();

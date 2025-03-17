<?php

namespace App\WebSocket;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Log\LoggerInterface;

class NotionWebSocketServer implements MessageComponentInterface
{
    protected $clients;
    protected $logger;
    protected $pageSubscriptions = [];
    protected $userConnections = [];
    protected $jwtSecret;

    public function __construct(LoggerInterface $logger)
    {
        $this->clients = new \SplObjectStorage();
        $this->logger = $logger;
        $this->jwtSecret = $_ENV['JWT_SECRET'] ?? 'your_jwt_secret_key_here';
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        $conn->userId = null;
        $conn->userName = null;
        $conn->isAuthenticated = false;

        $this->logger->info("New connection: {$conn->resourceId}");
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        try {
            $data = json_decode($msg, true);

            if (!isset($data['type'])) {
                return;
            }

            switch ($data['type']) {
                case 'auth':
                    $this->handleAuth($from, $data);
                    break;

                case 'subscribe':
                    $this->handleSubscribe($from, $data);
                    break;

                case 'unsubscribe':
                    $this->handleUnsubscribe($from, $data);
                    break;

                case 'block_update':
                    $this->handleBlockUpdate($from, $data);
                    break;

                case 'page_update':
                    $this->handlePageUpdate($from, $data);
                    break;

                case 'cursor_position':
                    $this->handleCursorPosition($from, $data);
                    break;

                case 'ping':
                    $from->send(json_encode(['type' => 'pong']));
                    break;
            }
        } catch (\Exception $e) {
            $this->logger->error("Error: " . $e->getMessage());
            $from->send(json_encode([
                'type' => 'error',
                'message' => 'Server error: ' . $e->getMessage()
            ]));
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->clients->detach($conn);
        $this->handleUserDisconnect($conn);
        $this->logger->info("Connection {$conn->resourceId} has disconnected");
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        $this->logger->error("Error: {$e->getMessage()}");
        $conn->close();
    }

    protected function handleAuth(ConnectionInterface $conn, array $data)
    {
        if (!isset($data['token'])) {
            $conn->send(json_encode([
                'type' => 'auth_error',
                'message' => 'Authentication token is required'
            ]));
            return;
        }

        try {
            $token = $data['token'];
            $decoded = JWT::decode($token, new Key($this->jwtSecret, 'HS256'));

            $conn->userId = $decoded->user_id;
            $conn->userName = $decoded->name;
            $conn->isAuthenticated = true;

            if (!isset($this->userConnections[$conn->userId])) {
                $this->userConnections[$conn->userId] = [];
            }
            $this->userConnections[$conn->userId][] = $conn;

            $conn->send(json_encode([
                'type' => 'auth_success'
            ]));

            $this->logger->info("User {$conn->userId} authenticated successfully");
        } catch (\Exception $e) {
            $conn->send(json_encode([
                'type' => 'auth_error',
                'message' => 'Invalid authentication token'
            ]));
            $this->logger->error("Authentication error: " . $e->getMessage());
        }
    }

    protected function handleSubscribe(ConnectionInterface $conn, array $data)
    {
        if (!$conn->isAuthenticated) {
            $conn->send(json_encode([
                'type' => 'error',
                'message' => 'Authentication required'
            ]));
            return;
        }

        if (!isset($data['page_id'])) {
            $conn->send(json_encode([
                'type' => 'error',
                'message' => 'Page ID is required'
            ]));
            return;
        }

        $pageId = $data['page_id'];

        // Add user to page subscription
        if (!isset($this->pageSubscriptions[$pageId])) {
            $this->pageSubscriptions[$pageId] = [];
        }
        $this->pageSubscriptions[$pageId][$conn->resourceId] = $conn;

        // Get other users currently on this page
        $otherUsers = [];
        foreach ($this->pageSubscriptions[$pageId] as $id => $client) {
            if ($id !== $conn->resourceId) {
                $otherUsers[] = [
                    'id' => $client->userId,
                    'name' => $client->userName
                ];
            }
        }

        // Confirm subscription
        $conn->send(json_encode([
            'type' => 'subscribed',
            'page_id' => $pageId,
            'users' => $otherUsers
        ]));

        // Notify other users of new user
        $this->broadcastToPage($pageId, [
            'type' => 'user_joined',
            'user' => [
                'id' => $conn->userId,
                'name' => $conn->userName
            ]
        ], [$conn->resourceId]);

        $this->logger->info("User {$conn->userId} subscribed to page {$pageId}");
    }

    protected function handleUnsubscribe(ConnectionInterface $conn, array $data)
    {
        if (!isset($data['page_id'])) {
            return;
        }

        $pageId = $data['page_id'];

        if (isset($this->pageSubscriptions[$pageId][$conn->resourceId])) {
            unset($this->pageSubscriptions[$pageId][$conn->resourceId]);

            // If no more subscribers, remove the page entry
            if (empty($this->pageSubscriptions[$pageId])) {
                unset($this->pageSubscriptions[$pageId]);
            } else {
                // Notify remaining users that this user left
                $this->broadcastToPage($pageId, [
                    'type' => 'user_left',
                    'user' => [
                        'id' => $conn->userId,
                        'name' => $conn->userName
                    ]
                ]);
            }

            $this->logger->info("User {$conn->userId} unsubscribed from page {$pageId}");
        }
    }

    protected function handleBlockUpdate(ConnectionInterface $from, array $data)
    {
        if (!$from->isAuthenticated) {
            return;
        }

        if (!isset($data['page_id']) || !isset($data['block_id']) || !isset($data['content'])) {
            return;
        }

        $pageId = $data['page_id'];

        $this->broadcastToPage($pageId, [
            'type' => 'block_updated',
            'user_id' => $from->userId,
            'block_id' => $data['block_id'],
            'content' => $data['content']
        ], [$from->resourceId]);
    }

    protected function handlePageUpdate(ConnectionInterface $from, array $data)
    {
        if (!$from->isAuthenticated) {
            return;
        }

        if (!isset($data['page_id']) || !isset($data['updates'])) {
            return;
        }

        $pageId = $data['page_id'];

        $this->broadcastToPage($pageId, [
            'type' => 'page_updated',
            'user_id' => $from->userId,
            'page_id' => $pageId,
            'updates' => $data['updates']
        ], [$from->resourceId]);
    }

    protected function handleCursorPosition(ConnectionInterface $from, array $data)
    {
        if (!$from->isAuthenticated) {
            return;
        }

        if (!isset($data['page_id']) || !isset($data['position'])) {
            return;
        }

        $pageId = $data['page_id'];

        $this->broadcastToPage($pageId, [
            'type' => 'cursor_position',
            'user_id' => $from->userId,
            'user_name' => $from->userName,
            'position' => $data['position']
        ], [$from->resourceId]);
    }

    protected function handleUserDisconnect(ConnectionInterface $conn)
    {
        if (!$conn->isAuthenticated || !$conn->userId) {
            return;
        }

        // Remove user from page subscriptions
        foreach ($this->pageSubscriptions as $pageId => $connections) {
            if (isset($connections[$conn->resourceId])) {
                unset($this->pageSubscriptions[$pageId][$conn->resourceId]);

                // Notify remaining users that this user left
                if (!empty($this->pageSubscriptions[$pageId])) {
                    $this->broadcastToPage($pageId, [
                        'type' => 'user_left',
                        'user' => [
                            'id' => $conn->userId,
                            'name' => $conn->userName
                        ]
                    ]);
                }

                // If no more subscribers, remove the page entry
                if (empty($this->pageSubscriptions[$pageId])) {
                    unset($this->pageSubscriptions[$pageId]);
                }
            }
        }

        // Remove user connection
        if (isset($this->userConnections[$conn->userId])) {
            foreach ($this->userConnections[$conn->userId] as $key => $connection) {
                if ($connection->resourceId === $conn->resourceId) {
                    unset($this->userConnections[$conn->userId][$key]);
                    break;
                }
            }

            if (empty($this->userConnections[$conn->userId])) {
                unset($this->userConnections[$conn->userId]);
            }
        }
    }

    protected function broadcastToPage(string $pageId, array $message, array $excludeIds = [])
    {
        if (!isset($this->pageSubscriptions[$pageId])) {
            return;
        }

        $encodedMessage = json_encode($message);

        foreach ($this->pageSubscriptions[$pageId] as $id => $client) {
            if (!in_array($id, $excludeIds)) {
                $client->send($encodedMessage);
            }
        }
    }
}

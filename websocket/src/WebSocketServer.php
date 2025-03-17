<?php

namespace App;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class WebSocketServer implements MessageComponentInterface
{
    protected $clients;
    protected $pageSubscriptions = [];
    protected $userConnections = [];
    protected $cursorPositions = [];

    public function __construct()
    {
        $this->clients = new \SplObjectStorage;
        echo "WebSocket server initialized\n";
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);
        $conn->resourceId = $conn->resourceId ?? uniqid('client-');
        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
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
                $this->sendToClient($from, [
                    'type' => 'pong',
                    'timestamp' => time()
                ]);
                break;
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->clients->detach($conn);

        // Remove user from subscriptions
        $userId = null;
        foreach ($this->userConnections as $id => $connection) {
            if ($connection === $conn) {
                $userId = $id;
                break;
            }
        }

        if ($userId) {
            unset($this->userConnections[$userId]);

            // Remove user cursor position and notify others
            foreach ($this->pageSubscriptions as $pageId => $subscribers) {
                if (($key = array_search($conn, $subscribers)) !== false) {
                    unset($this->pageSubscriptions[$pageId][$key]);

                    // If there are still subscribers, notify them the user left
                    if (!empty($this->pageSubscriptions[$pageId])) {
                        // Remove user's cursor
                        if (isset($this->cursorPositions[$pageId][$userId])) {
                            unset($this->cursorPositions[$pageId][$userId]);

                            // Notify other subscribers
                            $this->broadcastToPage($pageId, [
                                'type' => 'user_left',
                                'user_id' => $userId
                            ], $conn);
                        }
                    }
                }
            }
        }

        echo "Connection {$conn->resourceId} has disconnected\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "An error has occurred: {$e->getMessage()}\n";
        $conn->close();
    }

    protected function handleAuth(ConnectionInterface $client, array $data)
    {
        if (!isset($data['token'])) {
            $this->sendToClient($client, [
                'type' => 'auth_error',
                'message' => 'Missing token'
            ]);
            return;
        }

        try {
            // Verify JWT token
            $jwt = $data['token'];
            $jwtSecret = $_ENV['JWT_SECRET'] ?? 'development_jwt_secret';
            $decoded = JWT::decode($jwt, new Key($jwtSecret, 'HS256'));

            // Associate user ID with connection
            $userId = $decoded->user_id;
            $this->userConnections[$userId] = $client;
            $client->userId = $userId;

            // Send success response
            $this->sendToClient($client, [
                'type' => 'auth_success',
                'user_id' => $userId
            ]);

            echo "User {$userId} authenticated\n";
        } catch (\Exception $e) {
            $this->sendToClient($client, [
                'type' => 'auth_error',
                'message' => 'Invalid token: ' . $e->getMessage()
            ]);
        }
    }

    protected function handleSubscribe(ConnectionInterface $client, array $data)
    {
        if (!isset($data['page_id']) || !isset($client->userId)) {
            return;
        }

        $pageId = $data['page_id'];

        // Initialize page subscription array if not exists
        if (!isset($this->pageSubscriptions[$pageId])) {
            $this->pageSubscriptions[$pageId] = [];
        }

        // Add client to subscribers
        $this->pageSubscriptions[$pageId][] = $client;

        // Get all current users on this page
        $pageUsers = [];
        foreach ($this->pageSubscriptions[$pageId] as $subscriber) {
            if (isset($subscriber->userId) && $subscriber->userId !== $client->userId) {
                $pageUsers[] = $subscriber->userId;
            }
        }

        // Send confirmation and current active users
        $this->sendToClient($client, [
            'type' => 'subscribed',
            'page_id' => $pageId,
            'users' => $pageUsers,
            'cursors' => $this->cursorPositions[$pageId] ?? []
        ]);

        // Notify other subscribers about new user
        $this->broadcastToPage($pageId, [
            'type' => 'user_joined',
            'user_id' => $client->userId,
            'timestamp' => time()
        ], $client);

        echo "User {$client->userId} subscribed to page {$pageId}\n";
    }

    protected function handleUnsubscribe(ConnectionInterface $client, array $data)
    {
        if (!isset($data['page_id']) || !isset($client->userId)) {
            return;
        }

        $pageId = $data['page_id'];

        // Remove client from subscribers
        if (isset($this->pageSubscriptions[$pageId])) {
            if (($key = array_search($client, $this->pageSubscriptions[$pageId])) !== false) {
                unset($this->pageSubscriptions[$pageId][$key]);

                // Remove user's cursor
                if (isset($this->cursorPositions[$pageId][$client->userId])) {
                    unset($this->cursorPositions[$pageId][$client->userId]);
                }

                // Notify other subscribers
                $this->broadcastToPage($pageId, [
                    'type' => 'user_left',
                    'user_id' => $client->userId
                ], $client);

                echo "User {$client->userId} unsubscribed from page {$pageId}\n";
            }
        }
    }

    protected function handleBlockUpdate(ConnectionInterface $from, array $data)
    {
        if (!isset($data['page_id']) || !isset($data['block_id']) || !isset($from->userId)) {
            return;
        }

        $pageId = $data['page_id'];

        // Broadcast update to all subscribers of this page except sender
        $this->broadcastToPage($pageId, [
            'type' => 'block_updated',
            'page_id' => $pageId,
            'block_id' => $data['block_id'],
            'content' => $data['content'] ?? null,
            'user_id' => $from->userId,
            'timestamp' => time()
        ], $from);
    }

    protected function handlePageUpdate(ConnectionInterface $from, array $data)
    {
        if (!isset($data['page_id']) || !isset($from->userId)) {
            return;
        }

        $pageId = $data['page_id'];

        // Broadcast update to all subscribers of this page except sender
        $this->broadcastToPage($pageId, [
            'type' => 'page_updated',
            'page_id' => $pageId,
            'updates' => $data['updates'] ?? [],
            'user_id' => $from->userId,
            'timestamp' => time()
        ], $from);
    }

    protected function handleCursorPosition(ConnectionInterface $from, array $data)
    {
        if (!isset($data['page_id']) || !isset($from->userId)) {
            return;
        }

        $pageId = $data['page_id'];
        $userId = $from->userId;
        $position = [
            'x' => $data['position']['x'] ?? 0,
            'y' => $data['position']['y'] ?? 0,
            'block_id' => $data['position']['block_id'] ?? null
        ];

        // Store cursor position
        if (!isset($this->cursorPositions[$pageId])) {
            $this->cursorPositions[$pageId] = [];
        }

        $this->cursorPositions[$pageId][$userId] = $position;

        // Broadcast cursor position to other subscribers
        $this->broadcastToPage($pageId, [
            'type' => 'cursor_position',
            'user_id' => $userId,
            'position' => $position
        ], $from);
    }

    protected function broadcastToPage($pageId, $message, ConnectionInterface $except = null)
    {
        if (!isset($this->pageSubscriptions[$pageId])) {
            return;
        }

        foreach ($this->pageSubscriptions[$pageId] as $client) {
            if ($except !== $client) {
                $this->sendToClient($client, $message);
            }
        }
    }

    protected function sendToClient(ConnectionInterface $client, $data)
    {
        $client->send(json_encode($data));
    }
}

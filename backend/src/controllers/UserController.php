<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use App\Models\Entities\User;
use Monolog\Logger;
use Firebase\JWT\JWT;

class UserController
{
    private $container;
    private $entityManager;
    private $logger;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->entityManager = $container->get(EntityManager::class);
        $this->logger = $container->get(Logger::class);
    }

    public function getAll(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        try {
            // Get all users (for admin purposes)
            $users = $this->entityManager->getRepository(User::class)->findAll();

            $usersArray = [];
            foreach ($users as $u) {
                $usersArray[] = $u->toArray();
            }

            return $this->jsonResponse($response, ['status' => 'success', 'users' => $usersArray]);
        } catch (\Exception $e) {
            $this->logger->error('Error fetching users: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching users'],
                500
            );
        }
    }

    public function getById(Request $request, Response $response, array $args): Response
    {
        $currentUser = $this->getCurrentUser($request);
        if (!$currentUser) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'User ID is required'],
                400
            );
        }

        try {
            $user = $this->entityManager->getRepository(User::class)->find($id);
            if (!$user) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'User not found'],
                    404
                );
            }

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'user' => $user->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error fetching user: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching user'],
                500
            );
        }
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $currentUser = $this->getCurrentUser($request);
        if (!$currentUser) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'User ID is required'],
                400
            );
        }

        // Users can only update their own profile
        if ($id !== $currentUser->getId()) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'You can only update your own profile'],
                403
            );
        }

        $data = $request->getParsedBody();

        try {
            $user = $this->entityManager->getRepository(User::class)->find($id);
            if (!$user) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'User not found'],
                    404
                );
            }

            // Update fields if provided
            if (isset($data['name'])) {
                $user->setName($data['name']);
            }

            if (isset($data['email'])) {
                // Check if email is already taken
                $existingUser = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $data['email']]);
                if ($existingUser && $existingUser->getId() !== $user->getId()) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Email is already taken'],
                        400
                    );
                }
                $user->setEmail($data['email']);
            }

            if (isset($data['password'])) {
                $user->setPassword(password_hash($data['password'], PASSWORD_DEFAULT));
            }

            if (isset($data['profile_picture'])) {
                $user->setProfilePicture($data['profile_picture']);
            }

            // Update the user
            $user->setUpdatedAt(new \DateTime());
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'User updated successfully',
                    'user' => $user->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error updating user: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error updating user'],
                500
            );
        }
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $currentUser = $this->getCurrentUser($request);
        if (!$currentUser) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'User ID is required'],
                400
            );
        }

        // Users can only delete their own account
        if ($id !== $currentUser->getId()) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'You can only delete your own account'],
                403
            );
        }

        try {
            $user = $this->entityManager->getRepository(User::class)->find($id);
            if (!$user) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'User not found'],
                    404
                );
            }

            // Delete the user and all related data (workspaces, pages, blocks)
            $this->entityManager->remove($user);
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'User deleted successfully'
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error deleting user: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error deleting user'],
                500
            );
        }
    }

    /**
     * Get current user from JWT token
     */
    private function getCurrentUser(Request $request): ?User
    {
        $token = $this->getTokenFromRequest($request);
        if (!$token) {
            return null;
        }

        try {
            $decoded = JWT::decode($token, $_ENV['JWT_SECRET'], ['HS256']);
            return $this->entityManager->getRepository(User::class)->find($decoded->user_id);
        } catch (\Exception $e) {
            $this->logger->error('JWT decode error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get the currently authenticated user
     */
    public function getMe(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        return $this->jsonResponse(
            $response,
            [
                'status' => 'success',
                'user' => $user->toArray()
            ]
        );
    }

    /**
     * Extract JWT token from request headers
     */
    private function getTokenFromRequest(Request $request): ?string
    {
        $authHeader = $request->getHeaderLine('Authorization');
        if (!$authHeader) {
            return null;
        }

        $parts = explode(' ', $authHeader);
        if (count($parts) !== 2 || $parts[0] !== 'Bearer') {
            return null;
        }

        return $parts[1];
    }

    /**
     * Helper method to return JSON response
     */
    private function jsonResponse(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}

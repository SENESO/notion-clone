<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use Firebase\JWT\JWT;
use App\Models\Entities\User;
use Monolog\Logger;

class AuthController
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

    public function register(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['email']) || !isset($data['password']) || !isset($data['name'])) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Email, password, and name are required'], 400);
        }

        // Check if user with the same email already exists
        $existingUser = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $data['email']]);
        if ($existingUser) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'User with this email already exists'], 400);
        }

        try {
            // Create new user
            $user = new User();
            $user->setEmail($data['email'])
                ->setName($data['name'])
                ->setPassword(password_hash($data['password'], PASSWORD_DEFAULT));

            // Save user to database
            $this->entityManager->persist($user);
            $this->entityManager->flush();

            // Generate JWT token
            $token = $this->generateToken($user);

            return $this->jsonResponse($response, [
                'status' => 'success',
                'message' => 'User registered successfully',
                'user' => $user->toArray(),
                'token' => $token
            ]);
        } catch (\Exception $e) {
            $this->logger->error('Registration error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Registration failed'], 500);
        }
    }

    public function login(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['email']) || !isset($data['password'])) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Email and password are required'], 400);
        }

        // Find user by email
        $user = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $data['email']]);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Invalid credentials'], 401);
        }

        // Verify password
        if (!password_verify($data['password'], $user->getPassword())) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Invalid credentials'], 401);
        }

        // Generate JWT token
        $token = $this->generateToken($user);

        return $this->jsonResponse($response, [
            'status' => 'success',
            'message' => 'Login successful',
            'user' => $user->toArray(),
            'token' => $token
        ]);
    }

    public function refresh(Request $request, Response $response): Response
    {
        $data = $request->getParsedBody();

        // Validate token
        if (!isset($data['token'])) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Token is required'], 400);
        }

        try {
            // Decode token
            $decoded = JWT::decode($data['token'], $_ENV['JWT_SECRET'], ['HS256']);

            // Find user
            $user = $this->entityManager->getRepository(User::class)->find($decoded->user_id);
            if (!$user) {
                return $this->jsonResponse($response, ['status' => 'error', 'message' => 'User not found'], 404);
            }

            // Generate new token
            $token = $this->generateToken($user);

            return $this->jsonResponse($response, [
                'status' => 'success',
                'message' => 'Token refreshed',
                'token' => $token
            ]);
        } catch (\Exception $e) {
            $this->logger->error('Token refresh error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Invalid token'], 401);
        }
    }

    public function logout(Request $request, Response $response): Response
    {
        // In a stateless API, logout is handled on the client side by removing the token
        return $this->jsonResponse($response, [
            'status' => 'success',
            'message' => 'Logged out successfully'
        ]);
    }

    /**
     * Generate JWT token for a user
     */
    private function generateToken(User $user): string
    {
        $issuedAt = time();
        $expirationTime = $issuedAt + intval($_ENV['JWT_EXPIRATION']);

        $payload = [
            'user_id' => $user->getId(),
            'email' => $user->getEmail(),
            'name' => $user->getName(),
            'iat' => $issuedAt,
            'exp' => $expirationTime
        ];

        return JWT::encode($payload, $_ENV['JWT_SECRET']);
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

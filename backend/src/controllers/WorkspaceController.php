<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use App\Models\Entities\Workspace;
use App\Models\Entities\User;
use Monolog\Logger;
use Firebase\JWT\JWT;

class WorkspaceController
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
            // Get workspaces where user is owner or member
            $queryBuilder = $this->entityManager->createQueryBuilder();
            $queryBuilder->select('w')
                ->from(Workspace::class, 'w')
                ->where('w.owner = :user OR :user MEMBER OF w.members')
                ->setParameter('user', $user)
                ->orderBy('w.created_at', 'DESC');

            $workspaces = $queryBuilder->getQuery()->getResult();

            $workspacesArray = [];
            foreach ($workspaces as $workspace) {
                $workspacesArray[] = $workspace->toArray();
            }

            return $this->jsonResponse($response, ['status' => 'success', 'workspaces' => $workspacesArray]);
        } catch (\Exception $e) {
            $this->logger->error('Error fetching workspaces: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching workspaces'],
                500
            );
        }
    }

    public function getById(Request $request, Response $response, array $args): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Workspace ID is required'],
                400
            );
        }

        try {
            $workspace = $this->entityManager->getRepository(Workspace::class)->find($id);
            if (!$workspace) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Workspace not found'],
                    404
                );
            }

            // Check if user has access to the workspace
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this workspace'],
                    403
                );
            }

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'workspace' => $workspace->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error fetching workspace: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching workspace'],
                500
            );
        }
    }

    public function create(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['name'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Workspace name is required'],
                400
            );
        }

        try {
            // Create the workspace
            $workspace = new Workspace();
            $workspace->setName($data['name'])
                ->setOwner($user);

            // Set optional fields
            if (isset($data['description'])) {
                $workspace->setDescription($data['description']);
            }

            if (isset($data['icon'])) {
                $workspace->setIcon($data['icon']);
            }

            // Save the workspace
            $this->entityManager->persist($workspace);
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Workspace created successfully',
                    'workspace' => $workspace->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error creating workspace: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error creating workspace'],
                500
            );
        }
    }

    public function update(Request $request, Response $response, array $args): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Workspace ID is required'],
                400
            );
        }

        $data = $request->getParsedBody();

        try {
            $workspace = $this->entityManager->getRepository(Workspace::class)->find($id);
            if (!$workspace) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Workspace not found'],
                    404
                );
            }

            // Only the workspace owner can update it
            if ($workspace->getOwner()->getId() !== $user->getId()) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Only the workspace owner can update it'],
                    403
                );
            }

            // Update fields if provided
            if (isset($data['name'])) {
                $workspace->setName($data['name']);
            }

            if (isset($data['description'])) {
                $workspace->setDescription($data['description']);
            }

            if (isset($data['icon'])) {
                $workspace->setIcon($data['icon']);
            }

            // Update the workspace
            $workspace->setUpdatedAt(new \DateTime());
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Workspace updated successfully',
                    'workspace' => $workspace->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error updating workspace: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error updating workspace'],
                500
            );
        }
    }

    public function delete(Request $request, Response $response, array $args): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Workspace ID is required'],
                400
            );
        }

        try {
            $workspace = $this->entityManager->getRepository(Workspace::class)->find($id);
            if (!$workspace) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Workspace not found'],
                    404
                );
            }

            // Only the workspace owner can delete it
            if ($workspace->getOwner()->getId() !== $user->getId()) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Only the workspace owner can delete it'],
                    403
                );
            }

            // Delete the workspace and all related pages/blocks (cascade is configured in the entity)
            $this->entityManager->remove($workspace);
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Workspace deleted successfully'
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error deleting workspace: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error deleting workspace'],
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

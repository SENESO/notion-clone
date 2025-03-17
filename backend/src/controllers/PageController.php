<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use App\Models\Entities\Page;
use App\Models\Entities\Workspace;
use App\Models\Entities\User;
use Monolog\Logger;
use Firebase\JWT\JWT;

class PageController
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
        // Get the current user from the token
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        // Get query parameters
        $params = $request->getQueryParams();
        $workspaceId = $params['workspace_id'] ?? null;
        $parentId = $params['parent_id'] ?? null;

        try {
            $queryBuilder = $this->entityManager->createQueryBuilder();
            $queryBuilder->select('p')
                ->from(Page::class, 'p')
                ->join('p.workspace', 'w');

            // Filter by workspace if provided
            if ($workspaceId) {
                $queryBuilder->andWhere('w.id = :workspace_id')
                    ->setParameter('workspace_id', $workspaceId);
            } else {
                // If no workspace specified, only return pages from workspaces the user has access to
                $queryBuilder->andWhere('w.owner = :user OR :user MEMBER OF w.members')
                    ->setParameter('user', $user);
            }

            // Filter by parent if provided
            if ($parentId) {
                $queryBuilder->andWhere('p.parent = :parent_id')
                    ->setParameter('parent_id', $parentId);
            } else {
                // If no parent specified, only return root pages
                $queryBuilder->andWhere('p.parent IS NULL');
            }

            // Order by created date
            $queryBuilder->orderBy('p.created_at', 'DESC');

            $pages = $queryBuilder->getQuery()->getResult();

            $pagesArray = [];
            foreach ($pages as $page) {
                $pagesArray[] = $page->toArray();
            }

            return $this->jsonResponse($response, ['status' => 'success', 'pages' => $pagesArray]);
        } catch (\Exception $e) {
            $this->logger->error('Error fetching pages: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching pages'],
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
                ['status' => 'error', 'message' => 'Page ID is required'],
                400
            );
        }

        try {
            $page = $this->entityManager->getRepository(Page::class)->find($id);
            if (!$page) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Page not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this page'],
                    403
                );
            }

            // Get query parameters to determine what to include
            $params = $request->getQueryParams();
            $includeBlocks = isset($params['include_blocks']) && $params['include_blocks'] === 'true';
            $includeChildren = isset($params['include_children']) && $params['include_children'] === 'true';

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'page' => $page->toArray($includeBlocks, $includeChildren)
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error fetching page: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching page'],
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
        if (!isset($data['title']) || !isset($data['workspace_id'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Title and workspace_id are required'],
                400
            );
        }

        try {
            // Get the workspace
            $workspace = $this->entityManager->getRepository(Workspace::class)->find($data['workspace_id']);
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

            // Get parent page if specified
            $parent = null;
            if (isset($data['parent_id']) && $data['parent_id']) {
                $parent = $this->entityManager->getRepository(Page::class)->find($data['parent_id']);
                if (!$parent) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Parent page not found'],
                        404
                    );
                }

                // Check if parent page is in the same workspace
                if ($parent->getWorkspace()->getId() !== $workspace->getId()) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Parent page must be in the same workspace'],
                        400
                    );
                }
            }

            // Create the page
            $page = new Page();
            $page->setTitle($data['title'])
                ->setWorkspace($workspace)
                ->setParent($parent);

            // Set optional fields
            if (isset($data['icon'])) {
                $page->setIcon($data['icon']);
            }

            if (isset($data['cover'])) {
                $page->setCover($data['cover']);
            }

            if (isset($data['is_database']) && $data['is_database']) {
                $page->setIsDatabase(true);

                if (isset($data['database_properties'])) {
                    $page->setDatabaseProperties($data['database_properties']);
                }
            }

            // Save the page
            $this->entityManager->persist($page);
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Page created successfully',
                    'page' => $page->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error creating page: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error creating page'],
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
                ['status' => 'error', 'message' => 'Page ID is required'],
                400
            );
        }

        $data = $request->getParsedBody();

        try {
            $page = $this->entityManager->getRepository(Page::class)->find($id);
            if (!$page) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Page not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this page'],
                    403
                );
            }

            // Update fields if provided
            if (isset($data['title'])) {
                $page->setTitle($data['title']);
            }

            if (isset($data['icon'])) {
                $page->setIcon($data['icon']);
            }

            if (isset($data['cover'])) {
                $page->setCover($data['cover']);
            }

            if (isset($data['parent_id'])) {
                if (!$data['parent_id']) {
                    $page->setParent(null);
                } else {
                    $parent = $this->entityManager->getRepository(Page::class)->find($data['parent_id']);
                    if (!$parent) {
                        return $this->jsonResponse(
                            $response,
                            ['status' => 'error', 'message' => 'Parent page not found'],
                            404
                        );
                    }

                    // Check if parent page is in the same workspace
                    if ($parent->getWorkspace()->getId() !== $workspace->getId()) {
                        return $this->jsonResponse(
                            $response,
                            ['status' => 'error', 'message' => 'Parent page must be in the same workspace'],
                            400
                        );
                    }

                    $page->setParent($parent);
                }
            }

            if (isset($data['is_database'])) {
                $page->setIsDatabase($data['is_database']);
            }

            if (isset($data['database_properties'])) {
                $page->setDatabaseProperties($data['database_properties']);
            }

            // Update the page
            $page->setUpdatedAt(new \DateTime());
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Page updated successfully',
                    'page' => $page->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error updating page: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error updating page'],
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
                ['status' => 'error', 'message' => 'Page ID is required'],
                400
            );
        }

        try {
            $page = $this->entityManager->getRepository(Page::class)->find($id);
            if (!$page) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Page not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this page'],
                    403
                );
            }

            // Delete the page and all its children/blocks (cascade is configured in the entity)
            $this->entityManager->remove($page);
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Page deleted successfully'
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error deleting page: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error deleting page'],
                500
            );
        }
    }

    public function getBlocks(Request $request, Response $response, array $args): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Page ID is required'],
                400
            );
        }

        try {
            $page = $this->entityManager->getRepository(Page::class)->find($id);
            if (!$page) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Page not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this page'],
                    403
                );
            }

            // Get only root blocks (no parent)
            $blocks = [];
            foreach ($page->getBlocks() as $block) {
                if (!$block->getParent()) {
                    // Include children in the response
                    $blocks[] = $block->toArray(true);
                }
            }

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'blocks' => $blocks
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error fetching blocks: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching blocks'],
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

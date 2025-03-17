<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use App\Models\Entities\User;
use App\Models\Entities\Page;
use App\Models\Entities\Block;
use App\Models\Entities\Workspace;
use Monolog\Logger;
use Firebase\JWT\JWT;

class SearchController
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

    public function search(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['query'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Search query is required'],
                400
            );
        }

        $query = $data['query'];
        $workspaceId = $data['workspace_id'] ?? null;
        $limit = $data['limit'] ?? 20;
        $offset = $data['offset'] ?? 0;

        try {
            $results = [
                'pages' => [],
                'blocks' => []
            ];

            // Search in pages
            $pageQueryBuilder = $this->entityManager->createQueryBuilder();
            $pageQueryBuilder->select('p')
                ->from(Page::class, 'p')
                ->join('p.workspace', 'w')
                ->where('p.title LIKE :query OR p.metadata LIKE :query')
                ->andWhere('w.owner = :user OR :user MEMBER OF w.members')
                ->setParameter('query', '%' . $query . '%')
                ->setParameter('user', $user)
                ->setMaxResults($limit)
                ->setFirstResult($offset)
                ->orderBy('p.updated_at', 'DESC');

            if ($workspaceId) {
                $pageQueryBuilder->andWhere('w.id = :workspace_id')
                    ->setParameter('workspace_id', $workspaceId);
            }

            $pages = $pageQueryBuilder->getQuery()->getResult();

            foreach ($pages as $page) {
                $results['pages'][] = $page->toArray();
            }

            // Search in blocks
            $blockQueryBuilder = $this->entityManager->createQueryBuilder();
            $blockQueryBuilder->select('b')
                ->from(Block::class, 'b')
                ->join('b.page', 'p')
                ->join('p.workspace', 'w')
                ->where('JSON_CONTAINS(b.content, :query) = 1 OR JSON_CONTAINS(b.metadata, :query) = 1')
                ->andWhere('w.owner = :user OR :user MEMBER OF w.members')
                ->setParameter('query', json_encode('%' . $query . '%'))
                ->setParameter('user', $user)
                ->setMaxResults($limit)
                ->setFirstResult($offset)
                ->orderBy('b.updated_at', 'DESC');

            if ($workspaceId) {
                $blockQueryBuilder->andWhere('w.id = :workspace_id')
                    ->setParameter('workspace_id', $workspaceId);
            }

            $blocks = $blockQueryBuilder->getQuery()->getResult();

            foreach ($blocks as $block) {
                $results['blocks'][] = $block->toArray();
            }

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'results' => $results
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error performing search: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error performing search: ' . $e->getMessage()],
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

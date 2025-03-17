<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use App\Models\Entities\Block;
use App\Models\Entities\Page;
use App\Models\Entities\User;
use Monolog\Logger;
use Firebase\JWT\JWT;

class BlockController
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
                ['status' => 'error', 'message' => 'Block ID is required'],
                400
            );
        }

        try {
            $block = $this->entityManager->getRepository(Block::class)->find($id);
            if (!$block) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Block not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $page = $block->getPage();
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this block'],
                    403
                );
            }

            // Get query parameters to determine what to include
            $params = $request->getQueryParams();
            $includeChildren = isset($params['include_children']) && $params['include_children'] === 'true';

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'block' => $block->toArray($includeChildren)
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error fetching block: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error fetching block'],
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
        if (!isset($data['type']) || !isset($data['content']) || !isset($data['page_id'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Type, content, and page_id are required'],
                400
            );
        }

        try {
            // Get the page
            $page = $this->entityManager->getRepository(Page::class)->find($data['page_id']);
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

            // Get parent block if specified
            $parent = null;
            if (isset($data['parent_id']) && $data['parent_id']) {
                $parent = $this->entityManager->getRepository(Block::class)->find($data['parent_id']);
                if (!$parent) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Parent block not found'],
                        404
                    );
                }

                // Check if parent block is in the same page
                if ($parent->getPage()->getId() !== $page->getId()) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Parent block must be in the same page'],
                        400
                    );
                }
            }

            // Calculate the position (append to the end by default)
            $position = 0;

            if ($parent) {
                // If parent specified, calculate position among children
                $lastChild = $this->entityManager->createQueryBuilder()
                    ->select('b')
                    ->from(Block::class, 'b')
                    ->where('b.parent = :parent')
                    ->setParameter('parent', $parent)
                    ->orderBy('b.position', 'DESC')
                    ->setMaxResults(1)
                    ->getQuery()
                    ->getOneOrNullResult();

                if ($lastChild) {
                    $position = $lastChild->getPosition() + 1;
                }
            } else {
                // If no parent, calculate position among root blocks
                $lastBlock = $this->entityManager->createQueryBuilder()
                    ->select('b')
                    ->from(Block::class, 'b')
                    ->where('b.page = :page')
                    ->andWhere('b.parent IS NULL')
                    ->setParameter('page', $page)
                    ->orderBy('b.position', 'DESC')
                    ->setMaxResults(1)
                    ->getQuery()
                    ->getOneOrNullResult();

                if ($lastBlock) {
                    $position = $lastBlock->getPosition() + 1;
                }
            }

            // If position is specified, use it
            if (isset($data['position'])) {
                $position = (int) $data['position'];

                // Shift other blocks to accommodate the new position
                $blocksToShift = $this->entityManager->createQueryBuilder()
                    ->select('b')
                    ->from(Block::class, 'b')
                    ->where('b.page = :page')
                    ->andWhere($parent ? 'b.parent = :parent' : 'b.parent IS NULL')
                    ->andWhere('b.position >= :position')
                    ->setParameter('page', $page)
                    ->setParameter('position', $position)
                    ->orderBy('b.position', 'ASC')
                    ->getQuery()
                    ->getResult();

                if ($parent) {
                    $queryBuilder->setParameter('parent', $parent);
                }

                foreach ($blocksToShift as $blockToShift) {
                    $blockToShift->setPosition($blockToShift->getPosition() + 1);
                }
            }

            // Create the block
            $block = new Block();
            $block->setType($data['type'])
                ->setContent($data['content'])
                ->setPosition($position)
                ->setPage($page)
                ->setParent($parent);

            // Set optional fields
            if (isset($data['metadata'])) {
                $block->setMetadata($data['metadata']);
            }

            // Save the block
            $this->entityManager->persist($block);
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Block created successfully',
                    'block' => $block->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error creating block: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error creating block: ' . $e->getMessage()],
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
                ['status' => 'error', 'message' => 'Block ID is required'],
                400
            );
        }

        $data = $request->getParsedBody();

        try {
            $block = $this->entityManager->getRepository(Block::class)->find($id);
            if (!$block) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Block not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $page = $block->getPage();
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this block'],
                    403
                );
            }

            // Update fields if provided
            if (isset($data['type'])) {
                $block->setType($data['type']);
            }

            if (isset($data['content'])) {
                $block->setContent($data['content']);
            }

            if (isset($data['metadata'])) {
                $block->setMetadata($data['metadata']);
            }

            // Update position if provided
            if (isset($data['position'])) {
                $newPosition = (int) $data['position'];
                $oldPosition = $block->getPosition();

                if ($newPosition !== $oldPosition) {
                    $block->setPosition($newPosition);

                    // Reorder other blocks
                    $parent = $block->getParent();
                    $queryBuilder = $this->entityManager->createQueryBuilder();
                    $queryBuilder->select('b')
                        ->from(Block::class, 'b')
                        ->where('b.page = :page')
                        ->andWhere('b.id != :id')
                        ->andWhere($parent ? 'b.parent = :parent' : 'b.parent IS NULL')
                        ->setParameter('page', $page)
                        ->setParameter('id', $block->getId());

                    if ($parent) {
                        $queryBuilder->setParameter('parent', $parent);
                    }

                    if ($newPosition > $oldPosition) {
                        // Moving down
                        $queryBuilder->andWhere('b.position > :old_pos AND b.position <= :new_pos')
                            ->setParameter('old_pos', $oldPosition)
                            ->setParameter('new_pos', $newPosition)
                            ->orderBy('b.position', 'ASC');

                        $blocksToUpdate = $queryBuilder->getQuery()->getResult();
                        foreach ($blocksToUpdate as $blockToUpdate) {
                            $blockToUpdate->setPosition($blockToUpdate->getPosition() - 1);
                        }
                    } else {
                        // Moving up
                        $queryBuilder->andWhere('b.position >= :new_pos AND b.position < :old_pos')
                            ->setParameter('new_pos', $newPosition)
                            ->setParameter('old_pos', $oldPosition)
                            ->orderBy('b.position', 'ASC');

                        $blocksToUpdate = $queryBuilder->getQuery()->getResult();
                        foreach ($blocksToUpdate as $blockToUpdate) {
                            $blockToUpdate->setPosition($blockToUpdate->getPosition() + 1);
                        }
                    }
                }
            }

            // If parent_id is provided, update the parent
            if (isset($data['parent_id'])) {
                if (!$data['parent_id']) {
                    // If parent_id is null, move block to root level
                    $block->setParent(null);
                } else {
                    $parent = $this->entityManager->getRepository(Block::class)->find($data['parent_id']);
                    if (!$parent) {
                        return $this->jsonResponse(
                            $response,
                            ['status' => 'error', 'message' => 'Parent block not found'],
                            404
                        );
                    }

                    // Check if parent block is in the same page
                    if ($parent->getPage()->getId() !== $page->getId()) {
                        return $this->jsonResponse(
                            $response,
                            ['status' => 'error', 'message' => 'Parent block must be in the same page'],
                            400
                        );
                    }

                    // Prevent circular reference
                    if ($parent->getId() === $block->getId()) {
                        return $this->jsonResponse(
                            $response,
                            ['status' => 'error', 'message' => 'A block cannot be its own parent'],
                            400
                        );
                    }

                    $block->setParent($parent);
                }
            }

            // Update the block
            $block->setUpdatedAt(new \DateTime());
            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Block updated successfully',
                    'block' => $block->toArray()
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error updating block: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error updating block'],
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
                ['status' => 'error', 'message' => 'Block ID is required'],
                400
            );
        }

        try {
            $block = $this->entityManager->getRepository(Block::class)->find($id);
            if (!$block) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Block not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $page = $block->getPage();
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this block'],
                    403
                );
            }

            // Get block's position and parent for reordering
            $position = $block->getPosition();
            $parent = $block->getParent();

            // Delete the block and all its children (cascade is configured in the entity)
            $this->entityManager->remove($block);

            // Reorder remaining blocks
            $queryBuilder = $this->entityManager->createQueryBuilder();
            $queryBuilder->select('b')
                ->from(Block::class, 'b')
                ->where('b.page = :page')
                ->andWhere($parent ? 'b.parent = :parent' : 'b.parent IS NULL')
                ->andWhere('b.position > :position')
                ->setParameter('page', $page)
                ->setParameter('position', $position)
                ->orderBy('b.position', 'ASC');

            if ($parent) {
                $queryBuilder->setParameter('parent', $parent);
            }

            $blocksToUpdate = $queryBuilder->getQuery()->getResult();
            foreach ($blocksToUpdate as $blockToUpdate) {
                $blockToUpdate->setPosition($blockToUpdate->getPosition() - 1);
            }

            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Block deleted successfully'
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error deleting block: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error deleting block'],
                500
            );
        }
    }

    public function createChildren(Request $request, Response $response, array $args): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $id = $args['id'] ?? null;
        if (!$id) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Parent block ID is required'],
                400
            );
        }

        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['blocks']) || !is_array($data['blocks'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Blocks array is required'],
                400
            );
        }

        try {
            $parentBlock = $this->entityManager->getRepository(Block::class)->find($id);
            if (!$parentBlock) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'Parent block not found'],
                    404
                );
            }

            // Check if user has access to the page's workspace
            $page = $parentBlock->getPage();
            $workspace = $page->getWorkspace();
            if ($workspace->getOwner()->getId() !== $user->getId() && !$workspace->getMembers()->contains($user)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'You do not have access to this block'],
                    403
                );
            }

            // Get current max position
            $maxPosition = 0;
            $lastChild = $this->entityManager->createQueryBuilder()
                ->select('b')
                ->from(Block::class, 'b')
                ->where('b.parent = :parent')
                ->setParameter('parent', $parentBlock)
                ->orderBy('b.position', 'DESC')
                ->setMaxResults(1)
                ->getQuery()
                ->getOneOrNullResult();

            if ($lastChild) {
                $maxPosition = $lastChild->getPosition() + 1;
            }

            $createdBlocks = [];
            foreach ($data['blocks'] as $blockData) {
                // Validate block data
                if (!isset($blockData['type']) || !isset($blockData['content'])) {
                    continue;
                }

                // Create new block
                $block = new Block();
                $block->setType($blockData['type'])
                    ->setContent($blockData['content'])
                    ->setPosition($maxPosition++)
                    ->setPage($page)
                    ->setParent($parentBlock);

                if (isset($blockData['metadata'])) {
                    $block->setMetadata($blockData['metadata']);
                }

                $this->entityManager->persist($block);
                $createdBlocks[] = $block;
            }

            $this->entityManager->flush();

            // Convert blocks to array
            $blocksArray = [];
            foreach ($createdBlocks as $block) {
                $blocksArray[] = $block->toArray();
            }

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Blocks created successfully',
                    'blocks' => $blocksArray
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error creating blocks: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error creating blocks'],
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

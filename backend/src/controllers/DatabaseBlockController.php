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

class DatabaseBlockController
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

    /**
     * Create a new table block
     */
    public function createTable(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['page_id']) || !isset($data['columns']) || !is_array($data['columns'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'page_id and columns array are required'],
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

            // Check if user has access to the page
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
                if (!$parent || $parent->getPage()->getId() !== $page->getId()) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Invalid parent block'],
                        400
                    );
                }
            }

            // Calculate position (append to the end by default)
            $position = $this->calculateNextPosition($page, $parent);

            // Create the table block
            $tableBlock = new Block();
            $tableBlock->setType(Block::TYPE_TABLE)
                ->setContent([
                    'columns' => $data['columns'],
                    'has_header_row' => $data['has_header_row'] ?? true,
                ])
                ->setPosition($position)
                ->setPage($page)
                ->setParent($parent)
                ->setViewType($data['view_type'] ?? 'default');

            if (isset($data['metadata'])) {
                $tableBlock->setMetadata($data['metadata']);
            }

            // Persist the table block
            $this->entityManager->persist($tableBlock);

            // Create header row if needed
            if ($data['has_header_row'] ?? true) {
                $headerRow = new Block();
                $headerRow->setType(Block::TYPE_TABLE_ROW)
                    ->setContent(['is_header' => true])
                    ->setPosition(0)
                    ->setPage($page)
                    ->setParent($tableBlock);

                $this->entityManager->persist($headerRow);

                // Create header cells
                foreach ($data['columns'] as $index => $column) {
                    $cell = new Block();
                    $cell->setType(Block::TYPE_TABLE_CELL)
                        ->setContent(['text' => $column['name'] ?? "Column " . ($index + 1)])
                        ->setPosition($index)
                        ->setPage($page)
                        ->setParent($headerRow)
                        ->setMetadata(['column_id' => $column['id'] ?? null]);

                    $this->entityManager->persist($cell);
                }
            }

            // Create initial data rows if provided
            if (isset($data['rows']) && is_array($data['rows'])) {
                foreach ($data['rows'] as $rowIndex => $rowData) {
                    $row = new Block();
                    $row->setType(Block::TYPE_TABLE_ROW)
                        ->setContent([])
                        ->setPosition($rowIndex + 1) // +1 because of header row
                        ->setPage($page)
                        ->setParent($tableBlock);

                    $this->entityManager->persist($row);

                    // Create cells for each column
                    foreach ($data['columns'] as $colIndex => $column) {
                        $columnId = $column['id'] ?? null;
                        $cellValue = $rowData[$columnId] ?? "";

                        $cell = new Block();
                        $cell->setType(Block::TYPE_TABLE_CELL)
                            ->setContent(['text' => $cellValue])
                            ->setPosition($colIndex)
                            ->setPage($page)
                            ->setParent($row)
                            ->setMetadata(['column_id' => $columnId]);

                        $this->entityManager->persist($cell);
                    }
                }
            }

            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Table created successfully',
                    'table' => $tableBlock->toArray(true)
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error creating table: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error creating table: ' . $e->getMessage()],
                500
            );
        }
    }

    /**
     * Create a new Kanban board block
     */
    public function createKanban(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['page_id']) || !isset($data['columns']) || !is_array($data['columns'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'page_id and columns array are required'],
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

            // Check if user has access to the page
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
                if (!$parent || $parent->getPage()->getId() !== $page->getId()) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Invalid parent block'],
                        400
                    );
                }
            }

            // Calculate position (append to the end by default)
            $position = $this->calculateNextPosition($page, $parent);

            // Create the Kanban block
            $kanbanBlock = new Block();
            $kanbanBlock->setType(Block::TYPE_KANBAN)
                ->setContent([
                    'name' => $data['name'] ?? 'Kanban Board',
                    'item_property' => $data['item_property'] ?? 'title'
                ])
                ->setPosition($position)
                ->setPage($page)
                ->setParent($parent)
                ->setViewType($data['view_type'] ?? 'board');

            if (isset($data['metadata'])) {
                $kanbanBlock->setMetadata($data['metadata']);
            }

            // Persist the Kanban block
            $this->entityManager->persist($kanbanBlock);

            // Create columns
            foreach ($data['columns'] as $colIndex => $column) {
                $columnBlock = new Block();
                $columnBlock->setType(Block::TYPE_KANBAN_COLUMN)
                    ->setContent([
                        'title' => $column['title'] ?? "Column " . ($colIndex + 1),
                        'color' => $column['color'] ?? null
                    ])
                    ->setPosition($colIndex)
                    ->setPage($page)
                    ->setParent($kanbanBlock);

                $this->entityManager->persist($columnBlock);

                // Create initial items if provided
                if (isset($column['items']) && is_array($column['items'])) {
                    foreach ($column['items'] as $itemIndex => $item) {
                        $itemBlock = new Block();
                        $itemBlock->setType(Block::TYPE_KANBAN_ITEM)
                            ->setContent([
                                'title' => $item['title'] ?? "Item " . ($itemIndex + 1),
                                'description' => $item['description'] ?? "",
                                'color' => $item['color'] ?? null,
                                'due_date' => $item['due_date'] ?? null,
                                'assigned_to' => $item['assigned_to'] ?? null
                            ])
                            ->setPosition($itemIndex)
                            ->setPage($page)
                            ->setParent($columnBlock);

                        $this->entityManager->persist($itemBlock);
                    }
                }
            }

            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Kanban board created successfully',
                    'kanban' => $kanbanBlock->toArray(true)
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error creating Kanban board: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error creating Kanban board: ' . $e->getMessage()],
                500
            );
        }
    }

    /**
     * Create a new Calendar block
     */
    public function createCalendar(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $data = $request->getParsedBody();

        // Validate required fields
        if (!isset($data['page_id'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'page_id is required'],
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

            // Check if user has access to the page
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
                if (!$parent || $parent->getPage()->getId() !== $page->getId()) {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Invalid parent block'],
                        400
                    );
                }
            }

            // Calculate position (append to the end by default)
            $position = $this->calculateNextPosition($page, $parent);

            // Create the Calendar block
            $calendarBlock = new Block();
            $calendarBlock->setType(Block::TYPE_CALENDAR)
                ->setContent([
                    'name' => $data['name'] ?? 'Calendar',
                    'date_property' => $data['date_property'] ?? 'date',
                    'start_date' => $data['start_date'] ?? date('Y-m-d'),
                    'time_format' => $data['time_format'] ?? '24h'
                ])
                ->setPosition($position)
                ->setPage($page)
                ->setParent($parent)
                ->setViewType($data['view_type'] ?? 'month');

            if (isset($data['metadata'])) {
                $calendarBlock->setMetadata($data['metadata']);
            }

            // Persist the Calendar block
            $this->entityManager->persist($calendarBlock);

            // Create initial events if provided
            if (isset($data['events']) && is_array($data['events'])) {
                foreach ($data['events'] as $eventIndex => $event) {
                    $eventBlock = new Block();
                    $eventBlock->setType(Block::TYPE_CALENDAR_ITEM)
                        ->setContent([
                            'title' => $event['title'] ?? "Event " . ($eventIndex + 1),
                            'description' => $event['description'] ?? "",
                            'start_date' => $event['start_date'] ?? null,
                            'end_date' => $event['end_date'] ?? null,
                            'all_day' => $event['all_day'] ?? false,
                            'color' => $event['color'] ?? null,
                            'location' => $event['location'] ?? null,
                            'attendees' => $event['attendees'] ?? []
                        ])
                        ->setPosition($eventIndex)
                        ->setPage($page)
                        ->setParent($calendarBlock);

                    $this->entityManager->persist($eventBlock);
                }
            }

            $this->entityManager->flush();

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'Calendar created successfully',
                    'calendar' => $calendarBlock->toArray(true)
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error creating Calendar: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error creating Calendar: ' . $e->getMessage()],
                500
            );
        }
    }

    /**
     * Calculate the next position for a block
     */
    private function calculateNextPosition(Page $page, ?Block $parent = null): int
    {
        $queryBuilder = $this->entityManager->createQueryBuilder();
        $queryBuilder->select('b')
            ->from(Block::class, 'b')
            ->where('b.page = :page')
            ->setParameter('page', $page);

        if ($parent) {
            $queryBuilder->andWhere('b.parent = :parent')
                ->setParameter('parent', $parent);
        } else {
            $queryBuilder->andWhere('b.parent IS NULL');
        }

        $queryBuilder->orderBy('b.position', 'DESC')
            ->setMaxResults(1);

        $lastBlock = $queryBuilder->getQuery()->getOneOrNullResult();

        return $lastBlock ? $lastBlock->getPosition() + 1 : 0;
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

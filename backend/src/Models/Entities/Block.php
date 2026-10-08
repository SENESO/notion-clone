<?php

namespace App\Models\Entities;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

/**
 * @ORM\Entity
 * @ORM\Table(name="blocks")
 */
class Block
{
    const TYPE_TEXT = 'text';
    const TYPE_HEADING_1 = 'heading_1';
    const TYPE_HEADING_2 = 'heading_2';
    const TYPE_HEADING_3 = 'heading_3';
    const TYPE_BULLET_LIST = 'bullet_list';
    const TYPE_NUMBERED_LIST = 'numbered_list';
    const TYPE_TODO = 'todo';
    const TYPE_TOGGLE = 'toggle';
    const TYPE_QUOTE = 'quote';
    const TYPE_DIVIDER = 'divider';
    const TYPE_CALLOUT = 'callout';
    const TYPE_CODE = 'code';
    const TYPE_IMAGE = 'image';
    const TYPE_FILE = 'file';
    const TYPE_BOOKMARK = 'bookmark';
    const TYPE_EMBED = 'embed';
    const TYPE_TABLE = 'table';
    const TYPE_TABLE_ROW = 'table_row';
    const TYPE_TABLE_CELL = 'table_cell';
    const TYPE_KANBAN = 'kanban';
    const TYPE_KANBAN_COLUMN = 'kanban_column';
    const TYPE_KANBAN_ITEM = 'kanban_item';
    const TYPE_CALENDAR = 'calendar';
    const TYPE_CALENDAR_ITEM = 'calendar_item';
    const TYPE_DATABASE = 'database';
    const TYPE_DATABASE_ITEM = 'database_item';

    /**
     * @ORM\Id
     * @ORM\Column(type="string")
     * @ORM\GeneratedValue(strategy="CUSTOM")
     * @ORM\CustomIdGenerator(class="Ramsey\Uuid\Doctrine\UuidGenerator")
     */
    private $id;

    /**
     * @ORM\Column(type="string", length=50, nullable=false)
     */
    private $type;

    /**
     * @ORM\Column(type="json", nullable=false)
     */
    private $content;

    /**
     * @ORM\Column(type="integer", nullable=false)
     */
    private $position;

    /**
     * @ORM\ManyToOne(targetEntity="Page", inversedBy="blocks")
     * @ORM\JoinColumn(name="page_id", referencedColumnName="id", nullable=false)
     */
    private $page;

    /**
     * @ORM\ManyToOne(targetEntity="Block", inversedBy="children")
     * @ORM\JoinColumn(name="parent_id", referencedColumnName="id", nullable=true)
     */
    private $parent;

    /**
     * @ORM\OneToMany(targetEntity="Block", mappedBy="parent", cascade={"remove"})
     * @ORM\OrderBy({"position" = "ASC"})
     */
    private $children;

    /**
     * @ORM\Column(type="datetime", nullable=false)
     */
    private $created_at;

    /**
     * @ORM\Column(type="datetime", nullable=false)
     */
    private $updated_at;

    /**
     * @ORM\Column(type="json", nullable=true)
     */
    private $metadata;

    /**
     * @ORM\Column(type="string", length=50, nullable=true)
     */
    private $view_type;

    public function __construct()
    {
        $this->children = new ArrayCollection();
        $this->created_at = new \DateTime();
        $this->updated_at = new \DateTime();
    }

    // Getters and setters

    public function getId(): string
    {
        return $this->id;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getContent(): array
    {
        return $this->content;
    }

    public function setContent(array $content): self
    {
        $this->content = $content;
        return $this;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): self
    {
        $this->position = $position;
        return $this;
    }

    public function getPage(): Page
    {
        return $this->page;
    }

    public function setPage(Page $page): self
    {
        $this->page = $page;
        return $this;
    }

    public function getParent(): ?Block
    {
        return $this->parent;
    }

    public function setParent(?Block $parent): self
    {
        $this->parent = $parent;
        return $this;
    }

    public function getChildren(): Collection
    {
        return $this->children;
    }

    public function getCreatedAt(): \DateTime
    {
        return $this->created_at;
    }

    public function getUpdatedAt(): \DateTime
    {
        return $this->updated_at;
    }

    public function setUpdatedAt(\DateTime $updated_at): self
    {
        $this->updated_at = $updated_at;
        return $this;
    }

    public function getMetadata(): ?array
    {
        return $this->metadata;
    }

    public function setMetadata(?array $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    public function getViewType(): ?string
    {
        return $this->view_type;
    }

    public function setViewType(?string $view_type): self
    {
        $this->view_type = $view_type;
        return $this;
    }

    public function addChild(Block $child): self
    {
        if (!$this->children->contains($child)) {
            $this->children[] = $child;
            $child->setParent($this);
        }

        return $this;
    }

    /**
     * Is this block a special block type that can contain other blocks?
     */
    public function isContainer(): bool
    {
        return in_array($this->type, [
            self::TYPE_TOGGLE,
            self::TYPE_TABLE,
            self::TYPE_TABLE_ROW,
            self::TYPE_KANBAN,
            self::TYPE_KANBAN_COLUMN,
            self::TYPE_CALENDAR,
            self::TYPE_DATABASE
        ]);
    }

    /**
     * Is this block a specialized database-like block?
     */
    public function isDatabaseBlock(): bool
    {
        return in_array($this->type, [
            self::TYPE_TABLE,
            self::TYPE_KANBAN,
            self::TYPE_CALENDAR,
            self::TYPE_DATABASE
        ]);
    }

    /**
     * Convert to array for API responses
     */
    public function toArray(bool $include_children = false): array
    {
        $result = [
            'id' => $this->id,
            'type' => $this->type,
            'content' => $this->content,
            'position' => $this->position,
            'page_id' => $this->page->getId(),
            'parent_id' => $this->parent ? $this->parent->getId() : null,
            'metadata' => $this->metadata,
            'view_type' => $this->view_type,
            'created_at' => $this->created_at->format('c'),
            'updated_at' => $this->updated_at->format('c'),
            'has_children' => $this->children->count() > 0
        ];

        if ($include_children && $this->children->count() > 0) {
            $result['children'] = [];
            foreach ($this->children as $child) {
                $result['children'][] = $child->toArray(false);
            }
        }

        return $result;
    }
}

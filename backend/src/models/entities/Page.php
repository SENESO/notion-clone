<?php

namespace App\Models\Entities;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

/**
 * @ORM\Entity
 * @ORM\Table(name="pages")
 */
class Page
{
    /**
     * @ORM\Id
     * @ORM\Column(type="string")
     * @ORM\GeneratedValue(strategy="CUSTOM")
     * @ORM\CustomIdGenerator(class="Ramsey\Uuid\Doctrine\UuidGenerator")
     */
    private $id;

    /**
     * @ORM\Column(type="string", length=255, nullable=false)
     */
    private $title;

    /**
     * @ORM\Column(type="string", length=255, nullable=true)
     */
    private $icon;

    /**
     * @ORM\Column(type="string", length=255, nullable=true)
     */
    private $cover;

    /**
     * @ORM\ManyToOne(targetEntity="Workspace", inversedBy="pages")
     * @ORM\JoinColumn(name="workspace_id", referencedColumnName="id", nullable=false)
     */
    private $workspace;

    /**
     * @ORM\ManyToOne(targetEntity="Page", inversedBy="children")
     * @ORM\JoinColumn(name="parent_id", referencedColumnName="id", nullable=true)
     */
    private $parent;

    /**
     * @ORM\OneToMany(targetEntity="Page", mappedBy="parent", cascade={"remove"})
     * @ORM\OrderBy({"created_at" = "ASC"})
     */
    private $children;

    /**
     * @ORM\OneToMany(targetEntity="Block", mappedBy="page", cascade={"remove"})
     * @ORM\OrderBy({"position" = "ASC"})
     */
    private $blocks;

    /**
     * @ORM\Column(type="datetime", nullable=false)
     */
    private $created_at;

    /**
     * @ORM\Column(type="datetime", nullable=false)
     */
    private $updated_at;

    /**
     * @ORM\Column(type="boolean", nullable=false, options={"default": false})
     */
    private $is_database;

    /**
     * @ORM\Column(type="json", nullable=true)
     */
    private $database_properties;

    /**
     * @ORM\Column(type="text", nullable=true)
     */
    private $metadata;

    public function __construct()
    {
        $this->children = new ArrayCollection();
        $this->blocks = new ArrayCollection();
        $this->created_at = new \DateTime();
        $this->updated_at = new \DateTime();
        $this->is_database = false;
    }

    // Getters and setters

    public function getId(): string
    {
        return $this->id;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): self
    {
        $this->title = $title;
        return $this;
    }

    public function getIcon(): ?string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): self
    {
        $this->icon = $icon;
        return $this;
    }

    public function getCover(): ?string
    {
        return $this->cover;
    }

    public function setCover(?string $cover): self
    {
        $this->cover = $cover;
        return $this;
    }

    public function getWorkspace(): Workspace
    {
        return $this->workspace;
    }

    public function setWorkspace(Workspace $workspace): self
    {
        $this->workspace = $workspace;
        return $this;
    }

    public function getParent(): ?Page
    {
        return $this->parent;
    }

    public function setParent(?Page $parent): self
    {
        $this->parent = $parent;
        return $this;
    }

    public function getChildren(): Collection
    {
        return $this->children;
    }

    public function getBlocks(): Collection
    {
        return $this->blocks;
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

    public function isDatabase(): bool
    {
        return $this->is_database;
    }

    public function setIsDatabase(bool $is_database): self
    {
        $this->is_database = $is_database;
        return $this;
    }

    public function getDatabaseProperties(): ?array
    {
        return $this->database_properties;
    }

    public function setDatabaseProperties(?array $database_properties): self
    {
        $this->database_properties = $database_properties;
        return $this;
    }

    public function getMetadata(): ?string
    {
        return $this->metadata;
    }

    public function setMetadata(?string $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    public function addBlock(Block $block): self
    {
        if (!$this->blocks->contains($block)) {
            $this->blocks[] = $block;
            $block->setPage($this);
        }

        return $this;
    }

    public function addChild(Page $child): self
    {
        if (!$this->children->contains($child)) {
            $this->children[] = $child;
            $child->setParent($this);
        }

        return $this;
    }

    /**
     * Convert to array for API responses
     */
    public function toArray(bool $include_blocks = false, bool $include_children = false): array
    {
        $result = [
            'id' => $this->id,
            'title' => $this->title,
            'icon' => $this->icon,
            'cover' => $this->cover,
            'workspace_id' => $this->workspace->getId(),
            'parent_id' => $this->parent ? $this->parent->getId() : null,
            'is_database' => $this->is_database,
            'database_properties' => $this->database_properties,
            'created_at' => $this->created_at->format('c'),
            'updated_at' => $this->updated_at->format('c')
        ];

        if ($include_blocks) {
            $result['blocks'] = [];
            foreach ($this->blocks as $block) {
                $result['blocks'][] = $block->toArray();
            }
        }

        if ($include_children) {
            $result['children'] = [];
            foreach ($this->children as $child) {
                $result['children'][] = $child->toArray(false, false);
            }
        }

        return $result;
    }
}

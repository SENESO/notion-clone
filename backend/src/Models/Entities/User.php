<?php

namespace App\Models\Entities;

use Doctrine\ORM\Mapping as ORM;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

/**
 * @ORM\Entity
 * @ORM\Table(name="users")
 */
class User
{
    /**
     * @ORM\Id
     * @ORM\Column(type="string")
     * @ORM\GeneratedValue(strategy="CUSTOM")
     * @ORM\CustomIdGenerator(class="Ramsey\Uuid\Doctrine\UuidGenerator")
     */
    private $id;

    /**
     * @ORM\Column(type="string", length=255, nullable=false, unique=true)
     */
    private $email;

    /**
     * @ORM\Column(type="string", length=255, nullable=false)
     */
    private $name;

    /**
     * @ORM\Column(type="string", length=255, nullable=false)
     */
    private $password;

    /**
     * @ORM\Column(type="string", length=255, nullable=true)
     */
    private $profile_picture;

    /**
     * @ORM\Column(type="datetime", nullable=false)
     */
    private $created_at;

    /**
     * @ORM\Column(type="datetime", nullable=false)
     */
    private $updated_at;

    /**
     * @ORM\OneToMany(targetEntity="Workspace", mappedBy="owner")
     */
    private $workspaces;

    /**
     * @ORM\ManyToMany(targetEntity="Workspace", inversedBy="members")
     * @ORM\JoinTable(name="workspace_members")
     */
    private $member_workspaces;

    public function __construct()
    {
        $this->workspaces = new ArrayCollection();
        $this->member_workspaces = new ArrayCollection();
        $this->created_at = new \DateTime();
        $this->updated_at = new \DateTime();
    }

    // Getters and setters

    public function getId(): string
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): self
    {
        $this->email = $email;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;
        return $this;
    }

    public function getProfilePicture(): ?string
    {
        return $this->profile_picture;
    }

    public function setProfilePicture(?string $profile_picture): self
    {
        $this->profile_picture = $profile_picture;
        return $this;
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

    public function getWorkspaces(): Collection
    {
        return $this->workspaces;
    }

    public function getMemberWorkspaces(): Collection
    {
        return $this->member_workspaces;
    }

    public function addWorkspace(Workspace $workspace): self
    {
        if (!$this->workspaces->contains($workspace)) {
            $this->workspaces[] = $workspace;
            $workspace->setOwner($this);
        }

        return $this;
    }

    public function addMemberWorkspace(Workspace $workspace): self
    {
        if (!$this->member_workspaces->contains($workspace)) {
            $this->member_workspaces[] = $workspace;
        }

        return $this;
    }

    public function removeMemberWorkspace(Workspace $workspace): self
    {
        if ($this->member_workspaces->contains($workspace)) {
            $this->member_workspaces->removeElement($workspace);
        }

        return $this;
    }

    /**
     * Convert to array for API responses (without sensitive data)
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'profile_picture' => $this->profile_picture,
            'created_at' => $this->created_at->format('c'),
            'updated_at' => $this->updated_at->format('c')
        ];
    }
}

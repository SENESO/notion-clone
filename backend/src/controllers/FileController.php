<?php

namespace App\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Container\ContainerInterface;
use Doctrine\ORM\EntityManager;
use App\Models\Entities\User;
use Monolog\Logger;
use Firebase\JWT\JWT;
use Intervention\Image\ImageManagerStatic as Image;
use Ramsey\Uuid\Uuid;

class FileController
{
    private $container;
    private $entityManager;
    private $logger;
    private $uploadDir;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->entityManager = $container->get(EntityManager::class);
        $this->logger = $container->get(Logger::class);
        $this->uploadDir = $_ENV['UPLOAD_DIR'] ?? 'uploads';

        // Create upload directory if it doesn't exist
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0777, true);
        }
    }

    public function upload(Request $request, Response $response): Response
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return $this->jsonResponse($response, ['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        $uploadedFiles = $request->getUploadedFiles();

        // Check if any files were uploaded
        if (empty($uploadedFiles['file'])) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'No file uploaded'],
                400
            );
        }

        $uploadedFile = $uploadedFiles['file'];
        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Upload failed with error code ' . $uploadedFile->getError()],
                400
            );
        }

        try {
            // Generate a unique filename
            $extension = pathinfo($uploadedFile->getClientFilename(), PATHINFO_EXTENSION);
            $basename = Uuid::uuid4()->toString();
            $filename = $basename . '.' . $extension;
            $filePath = $this->uploadDir . '/' . $filename;

            // Move the uploaded file
            $uploadedFile->moveTo($filePath);

            // Get file metadata
            $fileSize = filesize($filePath);
            $mimeType = mime_content_type($filePath);
            $isImage = strpos($mimeType, 'image/') === 0;

            // For images, generate a thumbnail
            $thumbnailPath = null;
            if ($isImage) {
                $thumbnailFilename = $basename . '_thumb.' . $extension;
                $thumbnailPath = $this->uploadDir . '/' . $thumbnailFilename;

                // Create and save thumbnail
                $thumbnail = Image::make($filePath);
                $thumbnail->resize(300, null, function ($constraint) {
                    $constraint->aspectRatio();
                    $constraint->upsize();
                });
                $thumbnail->save($thumbnailPath);
            }

            // Prepare response data
            $fileData = [
                'id' => $basename,
                'filename' => $uploadedFile->getClientFilename(),
                'path' => $filePath,
                'url' => '/api/files/' . $basename,
                'size' => $fileSize,
                'mime_type' => $mimeType,
                'is_image' => $isImage
            ];

            if ($thumbnailPath) {
                $fileData['thumbnail_url'] = '/api/files/' . $basename . '/thumbnail';
            }

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'File uploaded successfully',
                    'file' => $fileData
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error uploading file: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error uploading file: ' . $e->getMessage()],
                500
            );
        }
    }

    public function getById(Request $request, Response $response, array $args): Response
    {
        $fileId = $args['id'] ?? null;
        if (!$fileId) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'File ID is required'],
                400
            );
        }

        // Check if the thumbnail is requested
        $isThumbnail = isset($args['thumbnail']) && $args['thumbnail'] === 'thumbnail';

        try {
            // Find file by ID
            $files = glob($this->uploadDir . '/' . $fileId . '.*');
            if (empty($files)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'File not found'],
                    404
                );
            }

            $filePath = $files[0];

            // If thumbnail is requested, check if it exists
            if ($isThumbnail) {
                $extension = pathinfo($filePath, PATHINFO_EXTENSION);
                $thumbnailPath = $this->uploadDir . '/' . $fileId . '_thumb.' . $extension;

                if (file_exists($thumbnailPath)) {
                    $filePath = $thumbnailPath;
                } else {
                    return $this->jsonResponse(
                        $response,
                        ['status' => 'error', 'message' => 'Thumbnail not found'],
                        404
                    );
                }
            }

            // Get file content and MIME type
            $fileContent = file_get_contents($filePath);
            $mimeType = mime_content_type($filePath);

            // Return file content with appropriate headers
            return $response
                ->withHeader('Content-Type', $mimeType)
                ->withHeader('Content-Disposition', 'inline')
                ->withHeader('Content-Length', strlen($fileContent))
                ->write($fileContent);
        } catch (\Exception $e) {
            $this->logger->error('Error retrieving file: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error retrieving file'],
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

        $fileId = $args['id'] ?? null;
        if (!$fileId) {
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'File ID is required'],
                400
            );
        }

        try {
            // Find file by ID
            $files = glob($this->uploadDir . '/' . $fileId . '.*');
            if (empty($files)) {
                return $this->jsonResponse(
                    $response,
                    ['status' => 'error', 'message' => 'File not found'],
                    404
                );
            }

            $filePath = $files[0];
            $extension = pathinfo($filePath, PATHINFO_EXTENSION);
            $thumbnailPath = $this->uploadDir . '/' . $fileId . '_thumb.' . $extension;

            // Delete the file
            unlink($filePath);

            // Delete thumbnail if it exists
            if (file_exists($thumbnailPath)) {
                unlink($thumbnailPath);
            }

            return $this->jsonResponse(
                $response,
                [
                    'status' => 'success',
                    'message' => 'File deleted successfully'
                ]
            );
        } catch (\Exception $e) {
            $this->logger->error('Error deleting file: ' . $e->getMessage());
            return $this->jsonResponse(
                $response,
                ['status' => 'error', 'message' => 'Error deleting file'],
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

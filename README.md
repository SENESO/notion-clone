# Notion Clone with PHP Backend

This project is a full-stack clone of Notion.com, implementing the core functionality with a PHP backend (Slim Framework) and a React frontend. The application features real-time collaboration, database-like blocks (tables, Kanban boards, calendars), and more.

## Features

- **User Authentication**: JWT-based authentication system
- **Workspaces**: Create and manage multiple workspaces
- **Hierarchical Pages**: Create nested pages with unlimited depth
- **Block-based Content**: Rich text editing with various block types
- **Database-like Blocks**: Tables, Kanban boards, and Calendars
- **Real-time Collaboration**: See other users' cursors and changes in real-time
- **File Uploads**: Support for image and file attachments
- **Search**: Full-text search across pages and blocks

## Project Structure

```
notion-php-clone/
├── backend/              # PHP backend (Slim Framework)
│   ├── bin/              # CLI scripts
│   ├── logs/             # Application logs
│   ├── public/           # Public files and entry point
│   ├── src/              # Source code
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # Controller classes
│   │   ├── middlewares/  # Middleware classes
│   │   ├── models/       # Data models
│   │   ├── routes/       # Route definitions
│   │   ├── services/     # Service classes
│   │   ├── utils/        # Utility functions
│   │   └── WebSocket/    # WebSocket server
│   ├── uploads/          # File uploads
│   ├── vendor/           # Dependencies
│   ├── .env              # Environment variables
│   ├── composer.json     # Composer configuration
│   └── Dockerfile        # Docker config for backend
│
├── frontend/             # React frontend (Vite + TypeScript)
│   ├── public/           # Static assets
│   ├── src/              # Source code
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── stores/       # Zustand state stores
│   │   └── lib/          # Utility functions
│   ├── package.json      # NPM dependencies
│   └── Dockerfile        # Docker config for frontend
│
├── docker-compose.yml    # Docker Compose configuration
└── README.md             # Project documentation
```

## Technology Stack

### Backend
- PHP 8.1
- Slim Framework 4
- PostgreSQL
- Doctrine ORM
- JWT Authentication
- Ratchet (WebSockets)
- Composer

### Frontend
- React 18
- TypeScript
- Zustand (State Management)
- React Router
- ShadcnUI / Tailwind CSS
- Axios

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Git

### Quick Start with Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/notion-php-clone.git
   cd notion-php-clone
   ```

2. Create a `.env` file for the Docker environment:
   ```bash
   echo "JWT_SECRET=your_secure_jwt_secret_here" > .env
   ```

3. Start the application using Docker Compose:
   ```bash
   docker-compose up -d
   ```

4. Initialize the database schema:
   ```bash
   docker-compose exec backend php bin/create-schema.php
   ```

5. Access the application:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000/api](http://localhost:8000/api)
   - Adminer (Database Management): [http://localhost:8081](http://localhost:8081)

### Manual Setup

#### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd notion-php-clone/backend
   ```

2. Install dependencies:
   ```bash
   composer install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Set up a PostgreSQL database and update the `.env` file with your database credentials.

5. Create the database schema:
   ```bash
   php bin/create-schema.php
   ```

6. Start the PHP development server:
   ```bash
   composer start
   ```

7. Start the WebSocket server:
   ```bash
   php bin/websocket-server.php
   ```

#### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd notion-php-clone/frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create an `.env` file with API and WebSocket URLs:
   ```
   REACT_APP_API_URL=http://localhost:8000/api
   REACT_APP_WS_URL=ws://localhost:8080
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

### User Registration and Login

1. Create a new account by visiting [http://localhost:3000/register](http://localhost:3000/register)
2. Log in with your credentials at [http://localhost:3000/login](http://localhost:3000/login)

### Creating Content

1. Create a workspace from the dashboard
2. Create pages within your workspace
3. Use the block editor to add content:
   - Text blocks
   - Headings
   - Lists
   - Tables
   - Kanban boards
   - Calendars
   - And more...

### Real-time Collaboration

1. Share the URL of a page with other users
2. See real-time cursors and changes as others edit the same page
3. Changes are automatically synchronized across all users

### Managing Files

1. Upload files and images directly in the editor
2. View and manage uploaded files
3. Include images and file attachments in your pages

## API Endpoints

See the full API documentation in the [API.md](API.md) file.

## License

MIT

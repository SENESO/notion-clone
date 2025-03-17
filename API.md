---

## Database Blocks

Database blocks are specialized blocks that can display data in different views like tables, Kanban boards, and calendars.

### Create Table

Creates a new table block.

- **URL:** `/database-blocks/table`
- **Method:** `POST`
- **Authentication:** Required

**Request Body:**

```json
{
  "page_id": "page-uuid",
  "columns": [
    {
      "id": "col-1",
      "name": "Name",
      "type": "text"
    },
    {
      "id": "col-2",
      "name": "Status",
      "type": "select"
    },
    {
      "id": "col-3",
      "name": "Date",
      "type": "date"
    }
  ],
  "has_header_row": true,
  "parent_id": null,
  "position": 0,
  "rows": [
    {
      "col-1": "Task 1",
      "col-2": "In Progress",
      "col-3": "2023-09-15"
    },
    {
      "col-1": "Task 2",
      "col-2": "Completed",
      "col-3": "2023-09-20"
    }
  ]
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Table created successfully",
  "table": {
    "id": "table-uuid",
    "type": "table",
    "content": {
      "columns": [
        {
          "id": "col-1",
          "name": "Name",
          "type": "text"
        },
        {
          "id": "col-2",
          "name": "Status",
          "type": "select"
        },
        {
          "id": "col-3",
          "name": "Date",
          "type": "date"
        }
      ],
      "has_header_row": true
    },
    "position": 0,
    "page_id": "page-uuid",
    "parent_id": null,
    "created_at": "2023-09-02T16:00:00Z",
    "updated_at": "2023-09-02T16:00:00Z",
    "has_children": true
  }
}
```

### Create Kanban Board

Creates a new Kanban board block.

- **URL:** `/database-blocks/kanban`
- **Method:** `POST`
- **Authentication:** Required

**Request Body:**

```json
{
  "page_id": "page-uuid",
  "name": "Project Tasks",
  "columns": [
    {
      "title": "To Do",
      "color": "blue",
      "items": [
        {
          "title": "Research competitors",
          "description": "Look at similar products",
          "due_date": "2023-09-30"
        }
      ]
    },
    {
      "title": "In Progress",
      "color": "yellow",
      "items": [
        {
          "title": "Design mockups",
          "description": "Create UI mockups for the dashboard",
          "due_date": "2023-09-25",
          "assigned_to": "Jane"
        }
      ]
    },
    {
      "title": "Done",
      "color": "green",
      "items": []
    }
  ],
  "parent_id": null,
  "position": 1
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Kanban board created successfully",
  "kanban": {
    "id": "kanban-uuid",
    "type": "kanban",
    "content": {
      "name": "Project Tasks",
      "item_property": "title"
    },
    "position": 1,
    "page_id": "page-uuid",
    "parent_id": null,
    "view_type": "board",
    "created_at": "2023-09-02T16:15:00Z",
    "updated_at": "2023-09-02T16:15:00Z",
    "has_children": true
  }
}
```

### Create Calendar

Creates a new Calendar block.

- **URL:** `/database-blocks/calendar`
- **Method:** `POST`
- **Authentication:** Required

**Request Body:**

```json
{
  "page_id": "page-uuid",
  "name": "Team Schedule",
  "events": [
    {
      "title": "Team Meeting",
      "description": "Weekly sync-up",
      "start_date": "2023-09-15T10:00:00Z",
      "end_date": "2023-09-15T11:00:00Z",
      "all_day": false,
      "color": "blue",
      "location": "Conference Room A"
    },
    {
      "title": "Product Launch",
      "description": "Launch of v2.0",
      "start_date": "2023-09-20",
      "all_day": true,
      "color": "green"
    }
  ],
  "parent_id": null,
  "position": 2
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Calendar created successfully",
  "calendar": {
    "id": "calendar-uuid",
    "type": "calendar",
    "content": {
      "name": "Team Schedule",
      "date_property": "date",
      "start_date": "2023-09-01",
      "time_format": "24h"
    },
    "position": 2,
    "page_id": "page-uuid",
    "parent_id": null,
    "view_type": "month",
    "created_at": "2023-09-02T16:30:00Z",
    "updated_at": "2023-09-02T16:30:00Z",
    "has_children": true
  }
}
```

---

## Files

### Upload File

Uploads a file.

- **URL:** `/files/upload`
- **Method:** `POST`
- **Authentication:** Required
- **Content-Type:** `multipart/form-data`

**Request Parameters:**

- `file` - The file to upload

**Response:**

```json
{
  "status": "success",
  "message": "File uploaded successfully",
  "file": {
    "id": "file-uuid",
    "filename": "document.pdf",
    "original_filename": "document.pdf",
    "size": 1024000,
    "mime_type": "application/pdf",
    "url": "http://localhost:8000/api/files/file-uuid",
    "thumbnail_url": "http://localhost:8000/api/files/file-uuid/thumbnail",
    "created_at": "2023-09-03T10:00:00Z"
  }
}
```

### Get File

Gets a file by ID.

- **URL:** `/files/{id}`
- **Method:** `GET`
- **Authentication:** Required
- **URL Parameters:** `id` - The file UUID

**Response:**

The file content with the appropriate MIME type.

### Get File Thumbnail

Gets a thumbnail for a file.

- **URL:** `/files/{id}/thumbnail`
- **Method:** `GET`
- **Authentication:** Required
- **URL Parameters:** `id` - The file UUID

**Response:**

The thumbnail image with the appropriate MIME type.

### Delete File

Deletes a file.

- **URL:** `/files/{id}`
- **Method:** `DELETE`
- **Authentication:** Required
- **URL Parameters:** `id` - The file UUID

**Response:**

```json
{
  "status": "success",
  "message": "File deleted successfully"
}
```

---

## Search

### Search

Performs a search across pages and blocks.

- **URL:** `/search`
- **Method:** `POST`
- **Authentication:** Required

**Request Body:**

```json
{
  "query": "project ideas",
  "workspace_id": "workspace-uuid",
  "limit": 20,
  "offset": 0
}
```

**Response:**

```json
{
  "status": "success",
  "results": {
    "pages": [
      {
        "id": "page-uuid-1",
        "title": "Project Ideas 2023",
        "icon": "💡",
        "workspace_id": "workspace-uuid",
        "parent_id": null,
        "created_at": "2023-08-15T12:00:00Z",
        "updated_at": "2023-09-01T14:30:00Z",
        "matches": [
          {
            "text": "Several new project ideas for Q4",
            "type": "title"
          }
        ]
      }
    ],
    "blocks": [
      {
        "id": "block-uuid-1",
        "type": "paragraph",
        "content": {
          "text": "Here are some project ideas to discuss"
        },
        "page_id": "page-uuid-2",
        "page_title": "Team Meeting Notes",
        "matches": [
          {
            "text": "Here are some project ideas to discuss",
            "type": "content"
          }
        ]
      }
    ]
  },
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

## WebSocket API

The WebSocket API provides real-time collaboration features.

### Connection

Connect to the WebSocket server at `ws://localhost:8080` (or `wss://yourdomain.com/ws` in production).

### Authentication

After connecting, send an authentication message:

```json
{
  "type": "auth",
  "token": "your-jwt-token"
}
```

**Response:**

```json
{
  "type": "auth_success"
}
```

Or in case of failure:

```json
{
  "type": "auth_error",
  "message": "Invalid authentication token"
}
```

### Subscribe to Page

Subscribe to real-time updates for a page:

```json
{
  "type": "subscribe",
  "page_id": "page-uuid"
}
```

**Response:**

```json
{
  "type": "subscribed",
  "page_id": "page-uuid",
  "users": [
    {
      "id": "user-uuid-1",
      "name": "John Doe"
    },
    {
      "id": "user-uuid-2",
      "name": "Jane Smith"
    }
  ]
}
```

### Unsubscribe from Page

Unsubscribe from a page:

```json
{
  "type": "unsubscribe",
  "page_id": "page-uuid"
}
```

### Block Update

Send a block update:

```json
{
  "type": "block_update",
  "page_id": "page-uuid",
  "block_id": "block-uuid",
  "content": {
    "text": "Updated text content"
  }
}
```

**Receiving Block Updates:**

```json
{
  "type": "block_updated",
  "user_id": "user-uuid",
  "block_id": "block-uuid",
  "content": {
    "text": "Updated text content"
  }
}
```

### Page Update

Send a page update:

```json
{
  "type": "page_update",
  "page_id": "page-uuid",
  "updates": {
    "title": "New Page Title"
  }
}
```

**Receiving Page Updates:**

```json
{
  "type": "page_updated",
  "user_id": "user-uuid",
  "page_id": "page-uuid",
  "updates": {
    "title": "New Page Title"
  }
}
```

### Cursor Position

Send cursor position for collaborative editing:

```json
{
  "type": "cursor_position",
  "page_id": "page-uuid",
  "position": {
    "x": 100,
    "y": 200,
    "block_id": "block-uuid"
  }
}
```

**Receiving Cursor Positions:**

```json
{
  "type": "cursor_position",
  "user_id": "user-uuid",
  "user_name": "John Doe",
  "position": {
    "x": 100,
    "y": 200,
    "block_id": "block-uuid"
  }
}
```

### User Joined/Left Notifications

When other users join or leave a page you're subscribed to:

```json
{
  "type": "user_joined",
  "user": {
    "id": "user-uuid",
    "name": "John Doe"
  }
}
```

```json
{
  "type": "user_left",
  "user": {
    "id": "user-uuid",
    "name": "John Doe"
  }
}
```

### Keep-Alive Ping

To keep the connection alive, send a ping every 30 seconds:

```json
{
  "type": "ping"
}
```

**Response:**

```json
{
  "type": "pong"
}
```

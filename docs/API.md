# API Reference

Base URL: `http://localhost:3000` (development)

## Authentication

No authentication required (local application).

## Endpoints

### Settings

#### `GET /api/settings`

Returns current configuration.

**Response:**
```json
{
  "dataDir": "E:\\LinkHub\\data",
  "userAgent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
  "llm": {
    "enabled": false,
    "provider": "openrouter",
    "apiKey": "",
    "model": "stepfun/step-3.5-flash:free",
    "autoCategorizeOnAdd": true,
    "fallbackToLocal": true
  },
  "localHeuristics": {
    "enabled": true,
    "domainCategoryRules": {
      "youtube.com": "Videos",
      "github.com": "Programming"
    }
  }
}
```

#### `POST /api/settings`

Update configuration.

**Request body:**
```json
{
  "dataDir": "string",
  "userAgent": "string",
  "llm": {
    "enabled": boolean,
    "provider": "openrouter",
    "apiKey": "string",
    "model": "string",
    "autoCategorizeOnAdd": boolean,
    "fallbackToLocal": boolean
  },
  "localHeuristics": {
    "enabled": boolean,
    "domainCategoryRules": { "domain.com": "Category" }
  }
}
```

**Response:** `{ "success": true, "message": "Settings saved successfully" }`

---

### Bookmarks

#### `GET /api/bookmarks`

List bookmarks with optional filters.

**Query params:**
- `categoryId` (string) — Filter by category (includes subcategories recursively)
- `tagId` (string) — Filter by tag
- `domain` (string) — Filter by domain
- `limit` (number) — Limit results (default: all)
- `offset` (number) — Pagination offset

**Response:** Array of bookmark objects with joined `category_name`, `category_color`, and `tags` array.

#### `POST /api/bookmarks`

Create a new bookmark.

**Request body:**
```json
{ "url": "https://example.com" }
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Example Domain",
  "url": "https://example.com",
  "success": true,
  "exists": false,
  "needsRefresh": true
}
```

#### `POST /api/bookmarks/:id/refresh`

Re-fetch metadata for a bookmark (title, description, images, content).

**Response:** Updated bookmark object.

#### `POST /api/bookmarks/:id/categorize`

Trigger LLM categorization for a single bookmark.

**Request body:**
```json
{ "force": false }  // true to recategorize even if already categorized
```

**Response:**
```json
{
  "success": true,
  "bookmark": { /* updated bookmark */ }
}
```

#### `POST /api/bookmarks/categorize-all`

Bulk categorize all uncategorized bookmarks.

**Request body:**
```json
{ "onlyUntagged": true }
```

**Response:**
```json
{
  "total": 199,
  "processed": 52,
  "failed": 147,
  "errors": ["Bookmark id: error message", ...]
}
```

#### `DELETE /api/bookmarks/:id`

Soft delete a bookmark.

#### `POST /api/bookmarks/bulk-delete`

Soft delete multiple bookmarks.

**Request body:**
```json
{ "ids": ["uuid1", "uuid2", ...] }
```

---

### Categories

#### `GET /api/categories`

List all categories (ordered by name).

**Response:** Array of category objects:
```json
[
  {
    "id": "uuid",
    "name": "Programming",
    "icon": "Code",
    "color": "#10b981",
    "parent_id": null,
    "created_at": "2026-03-14 06:31:25"
  }
]
```

---

### Tags

#### `GET /api/tags`

List all tags (ordered by name).

**Response:** Array of tag objects:
```json
[
  { "id": "uuid", "name": "react" },
  { "id": "uuid", "name": "typescript" }
]
```

---

### Domains

#### `GET /api/domains`

List unique domains with bookmark counts.

**Response:**
```json
[
  { "domain": "github.com", "count": 42 },
  { "domain": "youtube.com", "count": 15 }
]
```

---

### Categorization (LLM)

#### `POST /api/llm/test-connection`

Test OpenRouter API key and model availability.

**Request body:**
```json
{
  "provider": "openrouter",
  "apiKey": "sk-or-...",
  "model": "stepfun/step-3.5-flash:free"
}
```

**Response:**
```json
{ "success": true, "message": "Connected to OpenRouter successfully" }
```

#### `GET /api/categorization/stats`

Get categorization statistics.

**Response:**
```json
{
  "total": 199,
  "categorized": 52,
  "uncategorized": 147,
  "bySource": {
    "local": 52
  }
}
```

---

### Reader

#### `GET /api/bookmarks/:id/readability`

Fetch and parse article content for reader view.

**Response:**
```json
{
  "title": "Article Title",
  "content": "<p>Full HTML content...</p>",
  "byline": "Author Name",
  "excerpt": "Short excerpt..."
}
```

---

### Backup & Restore

#### `GET /api/backup`

Download full database backup as JSON.

#### `POST /api/restore`

Restore from backup JSON file.

**Request body:** Backup JSON structure (see code for schema).

---

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200` — Success
- `400` — Bad request (missing/invalid parameters)
- `404` — Not found
- `500` — Server error

Error format:
```json
{ "error": "Error message" }
```

---

## Notes

- All dates are ISO 8601 strings (UTC)
- Pagination not yet implemented (returns all matching records)
- `category_id` can be null (uncategorized)
- Categorization endpoints are async and may take time for bulk operations
- LLM categorization uses OpenRouter; ensure `llm.enabled` and valid `apiKey` in settings

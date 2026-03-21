# Architecture

## Tech Stack

- **Frontend**: React 18+ with TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js + Express
- **Desktop**: Electron (with packaged .exe builds)
- **Database**: SQLite (better-sqlite3)
- **AI**: OpenRouter API (multiple model support)

## Project Structure

```
LinkHub/
├── electron/           # Electron main process
│   └── main.ts        # Window management, server startup
├── src/               # React frontend
│   ├── App.tsx       # Main component with state management
│   ├── components/   # UI components
│   └── utils.ts      # Frontend utilities
├── server/           # Express backend
│   ├── routes/       # API routes
│   ├── services/     # Business logic
│   │   ├── llm/      # LLM categorization strategies
│   │   ├── scraper.ts
│   │   └── ai.ts     # Legacy Gemini AI (deprecated)
│   ├── db.ts         # Database initialization
│   └── config.ts     # Configuration loader
├── public/           # Static assets (icons, etc.)
├── data/             # SQLite database (development)
├── dist/             # Vite build output (frontend)
├── dist-electron/    # Electron build output (server + main)
└── docs/             # Documentation
```

## Design Patterns

### Strategy Pattern (LLM Categorization)

```typescript
interface ICategorizationStrategy {
  categorize(data: BookmarkData): Promise<CategorizationResult>;
  testConnection(): Promise<boolean>;
  getName(): string;
}

implementations:
  - OpenRouterStrategy (OpenRouter API)
  - LocalHeuristicsStrategy (domain rules)
```

### Factory Pattern

```typescript
class CategorizationStrategyFactory {
  static create(config: LLMConfig): ICategorizationStrategy {
    // Returns appropriate strategy based on provider
  }
}
```

### Service Layer

`CategorizationService` orchestrates:
1. Fetch bookmark data
2. Try LLM strategy (if enabled)
3. Fallback to local heuristics (if enabled)
4. Update database with category/tags
5. Handle errors gracefully

## Data Flow

### Bookmark Creation Flow

1. User adds URL → `POST /api/bookmarks`
2. Server creates bookmark with basic info
3. If `llm.autoCategorizeOnAdd` enabled, trigger async categorization
4. `CategorizationService.categorizeBookmark()`:
   - Fetches bookmark from DB
   - Prepares `BookmarkData` (url, title, description, domain, content)
   - LLM strategy categorizes → returns `{categoryId, newCategoryName, tags}`
   - If LLM fails and `fallbackToLocal` → local heuristics
   - Creates new category if needed
   - Updates bookmark with `category_id`, `categorization_at`, `categorization_source`
   - Creates/links tags in `bookmark_tags`
5. Frontend polls or manual refresh shows updated category

### Categorization Flow Diagram

```
[Bookmark Added]
      ↓
[Check: already categorized?] → Yes → [Return existing]
      ↓ No
[Try LLM Strategy]
      ↓ Success?
      ├─ Yes → [Update DB with category + tags] → Done
      └─ No [Fallback to Local Heuristics?]
          ├─ Yes → [Match domain → category] → [Update DB] → Done
          └─ No → [Leave uncategorized] → Done
```

## Database Schema

### Core Tables

- `bookmarks`: Core bookmark data
- `categories`: User-defined and AI-generated categories
- `tags`: Individual tags
- `bookmark_tags`: Many-to-many bookmark ↔ tag relationships
- `settings`: Key-value store for application settings

### Recent Changes (LLM Integration)

Added columns to `bookmarks`:
- `categorization_at` (DATETIME) — when categorization was performed
- `categorization_source` (TEXT) — 'llm', 'local', or null

## API Overview

### Categorization Endpoints

- `POST /api/llm/test-connection` — Test OpenRouter API key
- `GET /api/categorization/stats` — Get categorization statistics
- `POST /api/bookmarks/:id/categorize` — Categorize single bookmark
- `POST /api/bookmarks/categorize-all` — Bulk categorize uncategorized

### Standard Endpoints

- `GET /api/bookmarks` — List bookmarks (supports filtering)
- `POST /api/bookmarks` — Create bookmark
- `GET /api/categories` — List categories
- `GET /api/tags` — List tags
- `GET /api/settings` — Get configuration
- `POST /api/settings` — Save configuration

See [API Reference](./API.md) for full details.

## Configuration

Configuration stored in `linkhub.config.json` (auto-created):

```json
{
  "userAgent": "...",
  "dataDir": "...",
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

Settings can be edited via Settings Modal in the app.

## Extensibility

### Adding New LLM Providers

1. Create new strategy class implementing `ICategorizationStrategy`
2. Add to `CategorizationStrategyFactory.create()` switch
3. Update Settings Modal UI to include new provider options

### Adding Domain Heuristics Rules

Edit `linkhub.config.json` → `localHeuristics.domainCategoryRules`:

```json
{
  "domainCategoryRules": {
    "reddit.com": "Social",
    "stackoverflow.com": "Programming"
  }
}
```

Or use the Settings → Local Heuristics UI.

## Performance Considerations

- LLM requests are rate-limited; use `rateLimitDelay` config to avoid hitting limits
- Bulk categorization processes sequentially (not parallel) to respect rate limits
- SQLite WAL mode enabled for better concurrency
- Frontend uses React state management with localStorage persistence for UI preferences

## Security

- API keys stored locally in `linkhub.config.json` (not sent to any server except OpenRouter)
- Content Security Policy configured for Electron
- SQLite database uses WAL journaling for data integrity
- Foreign key constraints enforced

## Development Workflow

1. Make changes
2. Run `npm run lint` to check TypeScript
3. Run `npm run build` to compile
4. Test with `npm run dev:electron`
5. Commit and push

See [README.md](../README.md) for quick start guide.

# LLM Categorization Implementation Plan

## Overview
Add intelligent automatic categorization and tagging of bookmarks using OpenRouter API with local heuristics fallback.

## Architecture

### Pattern: Strategy + Factory + Orchestrator

```typescript
ICategorizationStrategy (interface)
  ├── OpenRouterStrategy (LLM via OpenRouter API)
  └── LocalHeuristicsStrategy (domain-based rules)

CategorizationStrategyFactory (creates strategies)
CategorizationService (orchestrator with fallback logic)
```

## Files to Create/Modify

### New Files (server/services/llm/)
- `interfaces.ts` - TypeScript interfaces (`ICategorizationStrategy`, `LLMConfig`, `CategorizationResult`)
- `openrouter.strategy.ts` - OpenRouter API integration
- `local-heuristics.strategy.ts` - Domain-based rule matching
- `factory.ts` - Strategy factory

### Modified Files
- `server/db.ts` - Add `categorization_at`, `categorization_source` columns
- `server/config.ts` - Support nested `llm` and `localHeuristics` config structure
- `server/services/categorizer.ts` - Main orchestrator service
- `server/routes/api.ts` - Add new endpoints:
  - `POST /api/llm/test-connection`
  - `GET /api/categorization/stats`
  - `POST /api/bookmarks/:id/categorize`
  - `POST /api/bookmarks/categorize-all`
- `src/components/SettingsModal.tsx` - LLM configuration UI
- `src/App.tsx` - Add "Uncategorized" section, "Categorize All" button, toast notifications
- `linkhub.config.json` - New config structure with defaults

### Database Schema Changes

```sql
ALTER TABLE bookmarks ADD COLUMN categorization_at DATETIME;
ALTER TABLE bookmarks ADD COLUMN categorization_source TEXT; -- 'llm' | 'local' | null
```

## Configuration Structure

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
      "youtu.be": "Videos",
      "github.com": "Programming",
      "npmjs.com": "Programming",
      "dribbble.com": "Design",
      "behance.com": "Design"
    }
  }
}
```

## Default Free Models (OpenRouter)

1. `stepfun/step-3.5-flash:free` (recommended)
2. `nvidia/nemotron-3-super-120b-a12b:free`
3. `arcee-ai/trinity-large-preview:free`

## Workflow

### Adding a Bookmark
1. User adds URL via `POST /api/bookmarks`
2. If `llm.enabled && autoCategorizeOnAdd` → trigger async categorization
3. `CategorizationService.categorizeBookmark()`:
   - Try LLM strategy
   - On failure → fallback to local heuristics (if enabled)
   - Update bookmark with `category_id`, `categorization_at`, `categorization_source`
   - Create/assign tags
4. Frontend polls or refreshes to show updated category

### Manual Bulk Categorization
1. User clicks "Categorize All" in sidebar (Uncategorized section)
2. Calls `POST /api/bookmarks/categorize-all`
3. Processes all bookmarks with `category_id IS NULL`
4. Returns stats: `{total, processed, failed, errors}`
5. UI shows toast with results

## Error Handling

- **LLM failure** (rate limit, auth, server error) → fallback to local heuristics
- **Local heuristics fail** → leave uncategorized (`category_id = null`)
- **Invalid category from LLM**: if `newCategoryName` → create new category automatically
- **Invalid JSON from LLM**: catch error, fallback to local

## UI Changes

### Settings Modal
- **Tab "AI & LLM"**: OpenRouter configuration
  - Enable/disable checkbox
  - Provider (disabled, only "OpenRouter")
  - API Key (password)
  - Model select (free + paid options)
  - Auto-categorize on add (checkbox)
  - Fallback to local heuristics (checkbox)
  - "Test Connection" button
- **Tab "Local Heuristics"**: Domain rules editor
  - List of domain → category mappings
  - Add/remove rules dynamically
  - Shows existing categories for reference

### Main Interface
- **Sidebar**: New "Uncategorized" section
  - Shows count of uncategorized bookmarks
  - "Categorize All" button
- **Bookmark cards**: Optional indicator of categorization source (tooltip)

## Implementation Steps

1. [ ] Add database migrations (`server/db.ts`)
2. [ ] Create `server/services/llm/interfaces.ts`
3. [ ] Implement `local-heuristics.strategy.ts`
4. [ ] Implement `openrouter.strategy.ts` with prompt engineering
5. [ ] Create `factory.ts`
6. [ ] Implement `categorizer.ts` service
7. [ ] Add API endpoints (`server/routes/api.ts`)
8. [ ] Update `config.ts` for backward compatibility
9. [ ] Update `SettingsModal.tsx` (swap Scraper tab → Heuristics, add AI tab)
10. [ ] Update `App.tsx` (states, handleCategorizeAll, Uncategorized section)
11. [ ] Test with real OpenRouter API key
12. [ ] Update `README.md` with LLM setup instructions

## Notes

- No detailed categorization logs stored (only `categorization_at` and `categorization_source`)
- Uncategorized category exists implicitly (bookmarks with `category_id = null`)
- New categories created automatically with random color/icon ("Folder")
- Batch processing uses delay between requests to avoid rate limits
- Settings require app restart to fully apply LLM config changes

## Future Enhancements

- Support multiple LLM providers (OpenAI, Anthropic direct)
- Categorization history/logs for audit
- Confidence score display
- Manual override with feedback loop
- Scheduled categorization job
- Category suggestions UI for uncategorized bookmarks

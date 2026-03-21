# LLM Categorization

LinkHub supports automatic bookmark categorization using LLM (Large Language Model) via OpenRouter, with fallback to local domain-based heuristics.

## Overview

When enabled, LLM categorization analyzes a bookmark's URL, title, description, and content to assign it to an appropriate category from your existing categories or suggest a new one. It also generates relevant tags.

## How It Works

### Categorization Flow

1. **Input**: Bookmark data (url, title, description, domain, content)
2. **LLM Request**: Send to OpenRouter with prompt containing existing categories
3. **Response Parsing**: Extract `categoryId`, `newCategoryName`, `parentCategoryId`, `tags`
4. **Category Resolution**:
   - If `categoryId` exists in DB → use it
   - If `newCategoryName` provided → create new category (random color, "Folder" icon)
   - If both missing → fail
5. **Tag Creation**: Create any new tags and link to bookmark
6. **Database Update**: Set `category_id`, `categorization_at`, `categorization_source`

### Fallback Chain

If LLM fails or is disabled:
1. **LLM** (primary) → if `llm.enabled` and API key present
2. **Local Heuristics** (fallback) → if `llm.fallbackToLocal` is `true` and domain matches a rule
3. **Uncategorized** → if all fail, bookmark remains uncategorized

---

## Configuration

See [Configuration](./CONFIGURATION.md) for detailed config options.

### Quick Setup

1. Get an OpenRouter API key from https://openrouter.ai/keys
2. In LinkHub, go to Settings → AI & LLM
3. Enable "LLM categorization"
4. Enter API key
5. Select model (recommended: `stepfun/step-3.5-flash:free`)
6. Click "Test Connection"
7. Save

---

## Supported Models

### Free Models (No Cost)

| Model ID | Provider | Notes |
|----------|----------|-------|
| `stepfun/step-3.5-flash:free` | Step AI | Recommended free model, good quality |
| `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA | Large model, rate-limited |
| `arcee-ai/trinity-large-preview:free` | Arcee | Preview model, may be unstable |

### Low-Cost Paid Models

| Model ID | Approx. Cost | Notes |
|----------|--------------|-------|
| `openai/gpt-4o-mini` | ~$0.10 / 1M tokens | Very good quality, fast |
| `anthropic/claude-3-haiku` | ~$0.20 / 1M tokens | Excellent classification |

**Tip:** Start with free models. If you need better accuracy or higher rate limits, upgrade to paid.

---

## Prompt Engineering

The LLM receives this prompt:

```
You are a bookmark categorization assistant. Analyze the web page and assign it to an appropriate category and tags.

Existing categories: ["Articles", "Design", "Programming", "Videos"]

Bookmark:
- URL: https://example.com
- Title: Example Domain
- Description: This is an example
- Content snippet: [first 2000 chars of extracted text]

Task:
1. Choose an existing category if it fits well. If none fits, suggest a NEW category name (simple, 1-3 words).
2. Suggest 3-5 relevant tags (lowercase, no spaces).
3. If suggesting a new category, optionally suggest a parent category from the existing list to create hierarchy.

Return strictly valid JSON:
{
  "categoryId": "existing category id" or null,
  "newCategoryName": "new category name" or null,
  "parentCategoryId": "parent category id if creating new" or null,
  "tags": ["tag1", "tag2", ...]
}
```

---

## Local Heuristics (Fallback)

When LLM is unavailable, LinkHub falls back to domain-based rules defined in `localHeuristics.domainCategoryRules`.

### Default Rules

```json
{
  "youtube.com": "Videos",
  "youtu.be": "Videos",
  "github.com": "Programming",
  "npmjs.com": "Programming",
  "dribbble.com": "Design",
  "behance.com": "Design"
}
```

### Extending Rules

Edit `linkhub.config.json` directly or use Settings → Local Heuristics UI:

```json
{
  "localHeuristics": {
    "domainCategoryRules": {
      "stackoverflow.com": "Programming",
      "reddit.com": "Social",
      "medium.com": "Articles",
      "dev.to": "Programming"
    }
  }
}
```

**Note:** Category names must match existing categories. If a category doesn't exist, it will be auto-created when a rule first matches.

---

## Usage

### Automatic Categorization

When `llm.autoCategorizeOnAdd` is `true` (default), every new bookmark is automatically categorized in the background. The UI will refresh after a few seconds to show the assigned category.

### Manual Bulk Categorization

1. Add bookmarks (they appear uncategorized initially)
2. In the sidebar, locate the **"Uncategorized"** section
3. Click **"Categorize All"** to process all uncategorized bookmarks at once
4. A toast notification shows the result: `"Categorized 150 of 199 bookmarks"`

**Note:** Bulk operation processes bookmarks sequentially to respect rate limits. For 200 bookmarks, this may take a few minutes depending on `rateLimitDelay` (default: no delay).

### Single Bookmark Categorization

You can also categorize an individual bookmark via the API:

```bash
curl -X POST http://localhost:3000/api/bookmarks/:id/categorize \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

`force: true` will recategorize even if the bookmark already has a category.

---

## Rate Limiting

OpenRouter has rate limits depending on your account and model. To avoid hitting limits:

- The `categorize-all` endpoint processes bookmarks **sequentially** (not in parallel)
- You can add a `rateLimitDelay` (ms) between requests in config
- Use free models during development; upgrade for higher limits

To add delay, edit `linkhub.config.json`:

```json
{
  "llm": {
    "rateLimitDelay": 1000  // Wait 1 second between requests
  }
}
```

---

## Database Changes

Two new columns added to `bookmarks` table:

- `categorization_at` (DATETIME) — When categorization was performed
- `categorization_source` (TEXT) — `'llm'`, `'local'`, or `null`

These are automatically populated by the categorization service.

---

## Troubleshooting

### "Could not determine category" errors

Common causes:
1. LLM API key is invalid or missing → check Settings → AI & LLM
2. LLM returned invalid JSON → check server logs
3. Domain not in local heuristics rules → add rule or enable LLM
4. Network error → retry or check OpenRouter status

### New categories being created excessively

LLM sometimes suggests new categories that are minor variations. To avoid this:
- Use a consistent model and prompt (already fixed in code)
- Manually merge similar categories via future UI improvements
- Set `fallbackToLocal: true` to rely on rules instead of LLM for predictable domains

### Categorization is slow

For large libraries (500+ bookmarks):
- Categorize in batches (manually trigger "Categorize All" subgroups)
- Add `rateLimitDelay` if hitting rate limits (slows down but avoids errors)
- Consider paid OpenRouter models for higher throughput

---

## API Reference

See [API Reference](./API.md) for endpoints:
- `POST /api/llm/test-connection`
- `GET /api/categorization/stats`
- `POST /api/bookmarks/:id/categorize`
- `POST /api/bookmarks/categorize-all`

---

## Advanced: Custom LLM Providers

Currently only OpenRouter is supported. To add other providers (OpenAI, Anthropic direct):

1. Implement `ICategorizationStrategy` for the provider
2. Add to `CategorizationStrategyFactory`
3. Update Settings Modal UI
4. Document model IDs for that provider

See `server/services/llm/openrouter.strategy.ts` as reference implementation.

---

## Development

### Testing with Dummy API Key

Even without a real OpenRouter key, you can test the flow:
1. Set any string as API key
2. The `test-connection` endpoint will call OpenRouter `/models` endpoint, which may succeed even without a valid key (OpenRouter allows model list without auth)
3. For actual categorization, a valid key with credits is required

### Simulating LLM Responses

For local development/testing, you can mock the OpenRouter strategy by creating a `MockStrategy` that returns predetermined results.

---

## Future Improvements

- [ ] Support for multiple LLM providers (OpenAI, Anthropic direct)
- [ ] Cache LLM responses to reduce API calls
- [ ] Categorization confidence score display
- [ ] Manual override with feedback to improve LLM prompt
- [ ] Scheduled auto-categorization for new bookmarks
- [ ] Category suggestions UI for uncategorized bookmarks
- [ ] Bulk "recategorize all" with different model/strategy

---

## See Also

- [Configuration](./CONFIGURATION.md) — Full config reference
- [API Reference](./API.md) — Endpoints
- [Architecture](../docs/ARCHITECTURE.md#llm-categorization) — System design

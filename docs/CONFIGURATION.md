# Configuration

LinkHub uses a JSON configuration file located at `linkhub.config.json` in your application directory (same folder as the executable for production, project root for development).

## Default Config

```json
{
  "userAgent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
  "dataDir": "E:\\dev\\LinkHub\\data",
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

## Settings Reference

### `userAgent`

User-Agent string used when fetching web pages for previews and content extraction.

**Default:** `"Mozilla/5.0 (compatible; Twitterbot/1.0)"`

**Can be changed via:** Settings Modal → General → Web Scraper

---

### `dataDir`

Path to the data directory where `bookmarks.db` is stored.

**Default:** Project root `./data` in development, `./data` next to executable in production.

**Can be changed via:** Settings Modal → General → Data Directory (requires restart to apply fully)

---

### `llm` (object)

Configuration for LLM-powered categorization.

#### `llm.enabled`

Enable/disable LLM categorization globally.

- `true` — Use LLM for categorization
- `false` — Only use local heuristics

**Default:** `false`

**Can be changed via:** Settings Modal → AI & LLM → "Enable LLM categorization"

---

#### `llm.provider`

LLM provider. Currently only **OpenRouter** is supported.

**Supported values:** `"openrouter"`

**Default:** `"openrouter"`

---

#### `llm.apiKey`

OpenRouter API key. Get yours at https://openrouter.ai/keys

**Important:** Keep this secret. Do not commit to version control.

**Default:** `""` (empty string)

**Can be changed via:** Settings Modal → AI & LLM → API Key

---

#### `llm.model`

OpenRouter model ID to use for categorization.

**Free models (recommended):**
- `stepfun/step-3.5-flash:free`
- `nvidia/nemotron-3-super-120b-a12b:free`
- `arcee-ai/trinity-large-preview:free`

**Low-cost paid models:**
- `openai/gpt-4o-mini` (~$0.1 / 1M tokens)
- `anthropic/claude-3-haiku` (~$0.2 / 1M tokens)

**Full list:** https://openrouter.ai/models

**Default:** `"stepfun/step-3.5-flash:free"`

**Can be changed via:** Settings Modal → AI & LLM → Model (dropdown)

---

#### `llm.autoCategorizeOnAdd`

If enabled, new bookmarks are automatically categorized as soon as they are added (async, non-blocking).

- `true` — Automatically categorize after adding
- `false` — Manual categorization only

**Default:** `true`

**Can be changed via:** Settings Modal → AI & LLM → "Auto-categorize on add"

---

#### `llm.fallbackToLocal`

If LLM fails (rate limit, error, invalid response), fall back to local heuristics (domain rules).

- `true` — Use local heuristics when LLM unavailable
- `false` — Leave uncategorized if LLM fails

**Default:** `true`

**Can be changed via:** Settings Modal → AI & LLM → "Fallback to local heuristics"

---

### `localHeuristics` (object)

Configuration for local (non-LLM) categorization based on domain rules.

#### `localHeuristics.enabled`

Enable/disable local heuristics.

**Default:** `true`

**Can be changed via:** Settings Modal → Local Heuristics (toggle)

---

#### `localHeuristics.domainCategoryRules`

Map of domain → category name. When a bookmark's domain matches, it is automatically assigned to that category.

**Rules:**
- Exact match: `"youtube.com"` matches `youtube.com`
- Suffix match: `"github.com"` matches `www.github.com`, `github.com`
- Case-insensitive

**Example:**
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

**Editing:**
- Manually edit `linkhub.config.json`
- Or use Settings Modal → Local Heuristics tab (add/remove rules dynamically)

**Note:** Category names must match existing categories in your database exactly. If a category doesn't exist, it will be auto-created (with random color/icon) when a rule matches.

---

## Backward Compatibility

If you have an older config with flat fields (`llmProvider`, `llmApiKey`, `llmModel`, `llmEndpoint`), they will be automatically migrated to the new nested `llm` structure on next read. The old fields are then removed when you save settings through the UI.

**Migration example:**

Old:
```json
{
  "llmProvider": "gemini",
  "llmApiKey": "key123",
  "llmModel": "gemini-3-flash-preview"
}
```

New (after migration):
```json
{
  "llm": {
    "enabled": true,
    "provider": "openrouter",
    "apiKey": "key123",
    "model": "stepfun/step-3.5-flash:free",
    "autoCategorizeOnAdd": true,
    "fallbackToLocal": true
  }
}
```

---

## Environment Variables

You can also set `DATA_DIR` environment variable to override the data directory location. This takes precedence over `dataDir` in config.

Example:
```bash
# Windows
set DATA_DIR=C:\MyData\LinkHub
npm run dev

# Linux/macOS
DATA_DIR=~/linkhub-data npm run dev
```

---

## Resetting Configuration

To reset to defaults:
1. Close the application
2. Delete or rename `linkhub.config.json`
3. Restart the app — a new config with defaults will be created

---

## Troubleshooting

### LLM Not Categorizing

- Check `llm.enabled` is `true`
- Verify `llm.apiKey` is set (and not expired)
- Check console/terminal for errors from OpenRouter
- Test connection via Settings → Test Connection button
- Verify `llm.model` is a valid OpenRouter model ID

### Local Heuristics Not Working

- Ensure `localHeuristics.enabled` is `true`
- Check domain spelling in `domainCategoryRules`
- Verify the domain of the bookmark matches exactly (use curl to check `domain` field)
- Ensure corresponding category exists in DB (or will be auto-created)

### Data Directory Not Changing

- Changing `dataDir` requires application restart to take full effect
- The database file is copied to the new location on first launch after change
- Close and reopen the app after saving settings

---

## See Also

- [LLM Categorization](./LLM_CATEGORIZATION.md) — How AI categorization works internally
- [API Reference](./API.md) — Settings-related endpoints
- [README](../README.md) — Quick start guide

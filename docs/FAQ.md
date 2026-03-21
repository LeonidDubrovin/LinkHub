# Frequently Asked Questions

## General

### What is LinkHub?

LinkHub is a desktop application for managing bookmarks with AI-powered automatic categorization. It runs locally on your computer and stores data in a SQLite database.

### Is LinkHub free?

Yes! LinkHub is open source under MIT license. You can use it for free forever. Optional AI features may incur costs if you use paid OpenRouter models, but the app itself is free.

### Does LinkHub sync across devices?

Not yet. LinkHub stores data locally. Future versions may offer cloud sync (self-hosted option planned).

### Can I use LinkHub without AI?

Absolutely. Local heuristics (domain rules) work without any API key. You can manually categorize bookmarks too.

---

## Installation & Setup

### Where is the database stored?

**Development mode** (`npm run dev`): `./data/bookmarks.db` in project folder.

**Production (packaged .exe)**: 
```
C:\Users\<YourUsername>\AppData\Roaming\LinkHub\bookmarks.db
```

See [Configuration](./CONFIGURATION.md) for changing the data directory.

### How do I backup my data?

Use **Settings → Backup & Restore** to export a JSON file. This contains all bookmarks, categories, tags, and settings.

Store backups safely. You can restore via the same dialog.

### How do I restore from backup?

1. Open Settings → Backup & Restore
2. Click "Choose File" and select your backup JSON
3. Click "Restore"
4. Restart the app

⚠️ **Warning**: Restore overwrites current data. Make a backup first!

---

## AI & Categorization

### Which AI providers are supported?

Currently **OpenRouter** only. This gives you access to many models (OpenAI, Anthropic, Step, NVIDIA, etc.) through one API.

Future versions may add direct OpenAI/Anthropic support.

### How much does AI categorization cost?

It depends on the model:

- **Free models** (stepfun, nvidia, arcee) — $0 (rate limited)
- **Paid models** (gpt-4o-mini, claude-3-haiku) — ~$0.10-0.20 per 1M tokens

A typical bookmark categorization uses ~500-1000 tokens, so costs are fractions of a cent.

### Why aren't my bookmarks being categorized?

Check:

1. **Settings → AI & LLM**: Is "Enable LLM categorization" checked?
2. **API Key**: Is it entered correctly? (no extra spaces)
3. **Test Connection**: Does it succeed?
4. **Auto-categorize on add**: Is it enabled? (or use manual "Categorize All")
5. **Console/terminal**: Look for error messages from OpenRouter

Common issues:
- Invalid API key → 401 error
- Rate limit → wait or upgrade OpenRouter account
- Network error → check internet connection

### Can I use my own OpenAI/Anthropic key?

Not directly yet. Currently only OpenRouter is supported. You can use OpenAI/Anthropic models **through OpenRouter** (they resell access).

### Does AI create new categories automatically?

Yes. If the model suggests a category name that doesn't exist, LinkHub creates it automatically with a random color and the "Folder" icon. You can edit the category later in the UI (coming soon) or just leave it.

### How do I prevent too many categories from being created?

- Use a consistent model (don't switch models frequently)
- Set `fallbackToLocal: true` to rely more on your domain rules
- Edit the OpenRouter prompt (would require code change)

---

## Local Heuristics

### What are local heuristics?

Simple domain → category mappings. When a bookmark's domain matches a rule, it gets that category without calling AI. Fast, free, works offline.

### How do I add a domain rule?

**Via Settings**:
1. Open Settings → Local Heuristics
2. Type domain (e.g., `reddit.com`) and category name (e.g., `Social`)
3. Click **+ Add Domain Rule**
4. Save

**Via config file** (`linkhub.config.json`):
```json
{
  "localHeuristics": {
    "domainCategoryRules": {
      "reddit.com": "Social"
    }
  }
}
```

### Can I use wildcards or regex?

Not yet. Exact domain or suffix match only. For example:
- `github.com` matches `github.com`, `www.github.com`, `sub.github.com`
- It does **not** match `github.example.com`

### What if my domain isn't in the rules?

If LLM is enabled and working, it will categorize via AI. If LLM is disabled or fails, the bookmark remains uncategorized until you add a matching rule or categorize manually.

---

## Categories & Tags

### Can I rename or delete categories?

Not yet through UI. You can:
- Rename directly in the database: `UPDATE categories SET name = 'New' WHERE id = 'uuid';`
- Delete: `DELETE FROM categories WHERE id = 'uuid';` (bookmarks will become uncategorized)

Future versions will have full category management.

### How do I merge two categories?

Currently there's no UI. Use SQL:

```sql
UPDATE bookmarks SET category_id = 'target-category-id' WHERE category_id = 'source-category-id';
DELETE FROM categories WHERE id = 'source-category-id';
```

### Why are some categories showing as null?

A bookmark with `category_id = NULL` is uncategorized. They appear under the "Uncategorized" section in the sidebar.

### Can I assign multiple categories to one bookmark?

No, each bookmark has exactly one category (but can have many tags).

---

## Troubleshooting

### App won't start / port already in use

Kill all Node.js and Electron processes:
```bash
taskkill /F /IM node.exe
taskkill /F /IM electron.exe
```
Then retry `npm run dev:electron`.

### Database errors / corruption

If the database is corrupted:
1. Close the app
2. Backup `data/bookmarks.db` (just in case)
3. Delete `data/bookmarks.db-wal` and `data/bookmarks.db-shm`
4. Restart app — it will recreate WAL files
5. If still broken, restore from backup

### API call failed: 413 Request Entity Too Large

The default Vite build produces a large bundle (~1.8MB). This is normal for development. Production builds are similar size. If you see this error in production, increase the body size limit in Express (not typically needed).

### Electron window opens then closes immediately

Check the terminal for error messages. Common causes:
- Missing `node_modules` → run `npm install`
- Build errors → run `npm run build` to see errors
- Port 3000 occupied → kill other processes

### CORS errors

Shouldn't happen in Electron (same origin). If developing with separate frontend/backend, add CORS middleware in `server/index.ts`.

---

## Performance

### Why is categorization slow for many bookmarks?

The `categorize-all` endpoint processes bookmarks **sequentially** to respect OpenRouter rate limits. For 200 bookmarks with 1-second delay between requests, it takes ~3-3 minutes.

You can:
- Reduce `rateLimitDelay` in config (risks rate limit errors)
- Categorize in smaller batches manually
- Use a paid OpenRouter model with higher limits

### Can I speed up bulk categorization?

Future versions may implement parallel processing with configurable concurrency. For now, sequential is safest.

---

## Privacy & Security

### Is my data sent to OpenRouter?

Only when you enable LLM categorization. The data sent includes:
- URL
- Page title
- Description
- First ~2000 characters of page content

No personal data is intentionally included, but the bookmark content may contain personal information. Review OpenRouter's privacy policy.

### Are API keys stored securely?

API keys are stored in `linkhub.config.json` in your data directory or project folder. This is a plain text file. Keep it secure and don't share it.

On Windows, you can restrict file permissions to your user only.

### Can I use LinkHub completely offline?

Yes! If you disable LLM and rely on local heuristics only, all processing happens locally. No external network calls are made.

---

## Contributing

Want to help? See [DEVELOPMENT.md](DEVELOPMENT.md) (if available) or open an issue on GitHub.

---

## More Help

- [Configuration Guide](./CONFIGURATION.md)
- [API Reference](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [LLM Categorization](./LLM_CATEGORIZATION.md)

Still stuck? Open an issue on GitHub with:
- OS version
- LinkHub version (commit hash)
- Steps to reproduce
- Error messages from console

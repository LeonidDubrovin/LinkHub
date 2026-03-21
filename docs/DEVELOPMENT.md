# Development Guide

This guide covers setting up a development environment and contributing to LinkHub.

## Prerequisites

- Node.js 20 or higher
- Git
- Windows (for Electron desktop testing) — Linux/macOS may work but not fully tested

---

## Quick Setup

```bash
# Clone and install
git clone https://github.com/yourusername/linkhub.git
cd linkhub
npm install

# Start development (server + Electron)
npm run dev:electron

# Or start server only (for web UI testing)
npm run dev
# Then open http://localhost:3000 in browser
```

---

## Project Structure

```
LinkHub/
├── electron/           # Electron main process
│   └── main.ts        # Window creation, server startup
├── src/               # React frontend
│   ├── App.tsx       # Main component (state, routing)
│   ├── components/   # UI components
│   │   ├── Icon.tsx
│   │   ├── DynamicCover.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── AddBookmarkModal.tsx
│   │   ├── Toast.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── ...
│   ├── utils.ts      # Frontend utilities (getDomain, getYouTubeId)
│   ├── types.ts      # TypeScript types
│   └── main.tsx      # React entry point
├── server/           # Express backend
│   ├── routes/
│   │   └── api.ts    # All API endpoints
│   ├── services/
│   │   ├── llm/      # LLM categorization (interfaces.ts, strategies)
│   │   ├── scraper.ts # Page fetching & metadata extraction
│   │   └── ai.ts     # Legacy Gemini AI (deprecated, may be removed)
│   ├── db.ts         # Database initialization & migrations
│   ├── config.ts     # Config loader with defaults
│   └── index.ts      # Server entry point
├── public/           # Static assets
├── data/             # Development database (gitignored)
├── dist/             # Vite build output (frontend)
├── dist-electron/    # tsup build output (server + Electron main)
├── docs/             # Documentation
└── .github/workflows/ # CI/CD (GitHub Actions)

```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Express server only (http://localhost:3000) |
| `npm run dev:electron` | Start Electron app (spawns server automatically) |
| `npm run build` | Build frontend (Vite) + server (tsup) |
| `npm run build:electron` | Build and package Electron app (generates installer) |
| `npm run lint` | TypeScript type checking (`tsc --noEmit`) |
| `npm run preview` | Preview production build (frontend only) |

---

## Development Workflow

### 1. Make Changes

- Frontend: edit files in `src/` → hot reload in Electron
- Backend: edit files in `server/` → restart server (Electron dev mode manages this)
- Shared: update types in `src/types.ts` or `server/services/llm/interfaces.ts`

### 2. Check Types

```bash
npm run lint
```

Fix any TypeScript errors before committing.

### 3. Test

- Run `npm run dev:electron` and test in the app
- Check browser console and terminal for errors
- Verify database changes (if any) with `sqlite3 data/bookmarks.db`

### 4. Build

```bash
npm run build
```

Ensure no build errors.

### 5. Commit

```bash
git add .
git commit -m "feat: describe your change"
```

Follow [Conventional Commits](https://www.conventionalcommits.org/) if possible:
- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — build, tooling, docs
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `docs:` — documentation only

---

## Database

### Schema

See `server/db.ts` for schema definitions. Key tables:
- `bookmarks`
- `categories`
- `tags`
- `bookmark_tags`
- `settings`

### Migrations

New columns are added via `ALTER TABLE` in `server/db.ts` (inside try-catch). When you run the app, migrations execute automatically.

### Inspecting Data

```bash
# List bookmarks
sqlite3 data/bookmarks.db "SELECT id, url, title, category_id FROM bookmarks LIMIT 5;"

# Count by category
sqlite3 data/bookmarks.db "SELECT c.name, COUNT(*) FROM bookmarks b JOIN categories c ON b.category_id = c.id GROUP BY c.name;"

# See uncategorized
sqlite3 data/bookmarks.db "SELECT COUNT(*) FROM bookmarks WHERE category_id IS NULL;"
```

---

## API Development

Add new endpoints in `server/routes/api.ts`.

Example:

```typescript
router.get("/my-endpoint", (req, res) => {
  res.json({ message: "Hello" });
});
```

Restart the server to see changes (Electron dev mode does this automatically on build).

---

## LLM Categorization

Implementation files:
- `server/services/llm/interfaces.ts` — `ICategorizationStrategy`, types
- `server/services/llm/openrouter.strategy.ts` — OpenRouter integration
- `server/services/llm/local-heuristics.strategy.ts` — Domain rules
- `server/services/llm/factory.ts` — Strategy factory
- `server/services/categorizer.ts` — Orchestrator

### Adding a New LLM Provider

1. Create `server/services/llm/your-provider.strategy.ts`
2. Implement `ICategorizationStrategy`:
   ```typescript
   class YourProviderStrategy implements ICategorizationStrategy {
     async categorize(data: BookmarkData): Promise<CategorizationResult> { ... }
     async testConnection(): Promise<boolean> { ... }
     getName(): string { return "YourProvider"; }
   }
   ```
3. Register in `factory.ts`:
   ```typescript
   switch (config.provider) {
     case 'yourprovider': return new YourProviderStrategy(config);
   }
   ```
4. Add UI options in `src/components/SettingsModal.tsx` (AI tab)

---

## Testing

Unit tests: not yet implemented. Manual testing recommended.

For API testing:
```bash
curl http://localhost:3000/api/bookmarks
```

For LLM testing:
```bash
curl -X POST http://localhost:3000/api/llm/test-connection \
  -H "Content-Type: application/json" \
  -d '{"provider":"openrouter","apiKey":"YOUR_KEY","model":"stepfun/step-3.5-flash:free"}'
```

---

## Debugging

### View Server Logs

Run server in terminal directly:
```bash
npx tsx server.ts
```

See console output for errors.

### View Database Queries

Enable better-sqlite3 logging:
```typescript
// In server/db.ts after creating db:
db.on("trace", (sql) => console.log("SQL:", sql));
```

### Inspect Electron DevTools

In the Electron window, press `F12` to open DevTools. Use Console and Network tabs.

### Clear Cache

If things behave strangely:
1. Delete `dist/` and `dist-electron/`
2. Run `npm run build`
3. Restart Electron

---

## Style Guide

### TypeScript

- Use explicit types for function returns and variables
- Prefer `interface` over `type` for object shapes
- Use camelCase for variables/functions, PascalCase for classes/components
- 2 spaces indentation

### React

- Functional components with hooks
- Props interfaces named `ComponentNameProps`
- Use `useCallback` for event handlers passed to child components
- Keep components small and focused

### CSS

- Tailwind CSS utility classes only (no custom CSS files)
- Use semantic classnames if needed for complex components
- Follow existing patterns in the codebase

---

## Common Tasks

### Add a new setting

1. Add default in `server/config.ts` → `getConfig()` return object
2. Add field to `linkhub.config.json` (it's auto-created from defaults)
3. Add to SettingsModal state and UI
4. Add to `POST /api/settings` handler

### Add a new API endpoint

1. Define in `server/routes/api.ts`
2. Add to `server/index.ts` router mount if new router
3. If uses services, import and use them
4. Document in `docs/API.md`

### Add a new database column

1. In `server/db.ts`, inside the `CREATE TABLE IF NOT EXISTS` block:
   ```sql
   ALTER TABLE bookmarks ADD COLUMN my_column TEXT;
   ```
2. Use try-catch to avoid errors if column exists
3. Update any queries that need the new column

---

## Troubleshooting Development

### "Cannot find module '.../dist-electron/server.js'"

Run `npm run build` first. The Electron main process imports the compiled server.

### Port 3000 already in use

Kill the existing process:
```bash
netstat -ano | findstr :3000
taskkill //F //PID <PID>
```

Or change the port in `server/index.ts` (not recommended).

### Electron window blank

Check:
- Server is running (console should say "Server running on http://localhost:3000")
- No errors in terminal
- Try rebuilding: `npm run build` then restart

### "Unexpected token" in Vite build

Clear caches:
```bash
rm -rf node_modules/.vite dist
npm install
npm run build
```

---

## Release Process

### Manual Release

1. Update version in `package.json`
2. Build and test: `npm run build:electron`
3. If installer works, commit and tag:
   ```bash
   git add .
   git commit -m "chore: release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```
4. GitHub Actions will build and create a Release automatically

### Automated Release

Push a tag starting with `v` (e.g., `v1.0.0`) → workflow triggers → Release draft created.

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and fix any errors
5. Test thoroughly
6. Submit a Pull Request with clear description

---

## Resources

- [Main README](../README.md)
- [Configuration docs](./CONFIGURATION.md)
- [API Reference](./API.md)
- [LLM Categorization](./LLM_CATEGORIZATION.md)
- [Architecture](./ARCHITECTURE.md)
- [FAQ](./FAQ.md)

---

Happy coding! 🚀

# Bug Report: Multiple Issues Found and Fixed

## Summary
Several bugs and issues were identified during code review and testing, including a critical ESM/CJS mismatch that would prevent the packaged Electron app from starting its server.

## Errors Found

### Error 1: Shorthand property out of scope (api.ts, line 598)
**Message:** `No value exists in scope for the shorthand property 'collectionIds'. Either declare one or provide an initializer.`

**Root Cause:** The `collectionIds` variable was declared inside the `db.transaction()` callback, but was referenced in the `return` statement outside that callback. In JavaScript/TypeScript, `const`/`let` variables are block-scoped, so `collectionIds` was not accessible after the transaction block.

**Fix:** Moved the `collectionIds` declaration before the `db.transaction()` call so it is in scope for both the transaction callback and the return statement.

### Error 2: Possibly undefined value passed to path.join (api.ts, line 67)
**Message:** `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`

**Root Cause:** `getDataDir()` returns `string | undefined`, but `path.join()` requires a `string` argument.

**Fix:** Added the non-null assertion operator (`!`) to `getDataDir()` since the data directory is always initialized at module load time in `server/db.ts`.

### Error 3: ESM/CJS mismatch — `require()` cannot load ESM server.js (CRITICAL)
**Root Cause:** `electron/main.cjs` used `require("./server.js")` to load the bundled server, but `tsup.config.ts` outputs `server.js` in ESM format (`format: ["esm"]`). In Node.js, `require()` cannot load ESM modules — it throws `ERR_REQUIRE_ESM`. This means the packaged Electron app would crash when trying to start the internal Express server.

**Fix:** Changed both `electron/main.ts` and `electron/main.cjs` to use `await import("./server.js")` (dynamic import) instead of `require()`. Dynamic `import()` works for both ESM and CJS modules.

### Error 4: DevTools forcibly opened in production build
**Root Cause:** `electron/main.ts` unconditionally called `mainWindow.webContents.openDevTools()`, which opens Chrome DevTools even in the packaged production app.

**Fix:** Wrapped `openDevTools()` in `if (!app.isPackaged)` so it only opens in development mode.

### Error 5: Dev mode port mismatch in electron/main.cjs
**Root Cause:** The committed `electron/main.cjs` used a hardcoded port 3070 in dev mode, while `electron/main.ts` reads the actual port from the `.server-port` file. Since the server may fall back to a random port (e.g., if 3070 is reserved by Windows), the Electron window would load the wrong URL and show a blank page.

**Fix:** Updated `electron/main.cjs` to read from `.server-port` file, matching `main.ts`.

### Error 6: Duplicate `images_json` migration in db.ts
**Root Cause:** `ALTER TABLE bookmarks ADD COLUMN images_json TEXT` was executed twice (lines 122 and 145). While the second execution is caught by try/catch, it's redundant code.

**Fix:** Removed the duplicate migration attempt.

### Error 7: Empty `collectionIds` array causes `undefined` category_id (api.ts)
**Root Cause:** `POST /bookmarks/:id/collections` allows an empty `collectionIds` array (to remove all collection associations), but then unconditionally runs `db.prepare("UPDATE bookmarks SET category_id = ? WHERE id = ?").run(collectionIds[0], id)`. When `collectionIds` is empty, `collectionIds[0]` is `undefined`, which SQLite stores as NULL. This is technically valid but semantically wrong — the code should explicitly set `category_id = NULL`.

**Fix:** Added conditional: if `collectionIds.length > 0`, use first ID; else, explicitly set `category_id = NULL`.

### Error 8: `ai.ts` uses old flat config structure
**Root Cause:** `server/services/ai.ts` read `config.llmProvider`, `config.llmApiKey`, `config.llmModel` (old flat structure), but `server/config.ts` now returns a nested `config.llm` object after migrating from the old format. This meant the AI categorization always used defaults and ignored user configuration.

**Fix:** Updated `ai.ts` to read from `config.llm.provider`, `config.llm.apiKey`, `config.llm.model`.

### Error 9: Build fails — tsup bundles vite with native deps
**Root Cause:** `server.ts` conditionally imports `vite` for dev mode (`await import("vite")`). tsup attempted to bundle vite and its native dependencies (like lightningcss), causing the build to fail with `Could not resolve "../pkg"`.

**Fix:** Added `"vite"` to tsup's `external` list for the server entry.

## Changes Made
- `electron/main.ts`: Changed `require()` → `import()` for server.js, conditional DevTools, port file reading
- `electron/main.cjs`: Synced with main.ts changes
- `server/db.ts`: Removed duplicate `images_json` migration
- `server/routes/api.ts`: Fixed empty `collectionIds` handling
- `server/services/ai.ts`: Use nested `config.llm` structure
- `tsup.config.ts`: Added `vite` to server externals
- `package.json`: Moved build-time deps to devDependencies, improved electron-builder config
- `.gitignore`: Added `test-*.html`, `metadata.json`
- `.github/workflows/build.yml`: Rewritten with proper CI/CD pipeline

## Verification
- `npx tsc --noEmit` passes with exit code 0
- `npm run build` succeeds (vite build + tsup)
- `npm test` passes (4/4 tests)
- Dev server starts correctly with port file creation and fallback
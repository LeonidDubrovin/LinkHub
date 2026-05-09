# Implementation Plan: Spaces & Collections (Raindrop-like)

**Goal:** Refactor LinkHub to use Spaces + Collections model with multi-label support, similar to Raindrop.io.

---

## ✅ Decisions Made

1. **Cross-space bookmarks:** ✅ Allowed (Raindrop style)
   - Bookmarks can belong to collections from different spaces
   - UI shows all collections a bookmark belongs to
   - Clicking collection link navigates to that collection with bookmark focused

2. **Inbox handling:** ✅ Global "Inbox" collection
   - New bookmarks without explicit collection assignment go to Inbox
   - Inbox is a special, non-deletable collection in a default "Inbox" space (or system space)
   - Always visible in sidebar

3. **AI categorization:** ✅ Keep in code, disabled by default
   - User can enable in Settings
   - Returns single collection (can extend to multi-label later)
   - Mark in code as optional feature

4. **Domain heuristics:** ✅ Keep for now
   - Domain → collection auto-assignment
   - Works alongside new collections system

---

## 🗄️ Database Schema Changes

### New Tables

```sql
-- Spaces (top-level containers)
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Collections (replaces categories, belong to spaces, can nest)
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  space_id TEXT NOT NULL,
  parent_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES collections(id)
);

-- Bookmark ↔ Collection many-to-many
CREATE TABLE IF NOT EXISTS bookmark_collections (
  bookmark_id TEXT,
  collection_id TEXT,
  PRIMARY KEY (bookmark_id, collection_id),
  FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);
```

### Migration Steps (on app startup, one-time)

1. **Create "Inbox" space** if not exists
   - id: `inbox-space`
   - name: "Inbox"
   - icon: "Inbox"
   - color: "#6b7280"

2. **Create "Inbox" collection** in Inbox space
   - id: `inbox-collection`
   - name: "Inbox"
   - space_id: `inbox-space`
   - Special flag? Or just by ID

3. **Migrate existing categories to collections**
   - For each category in old `categories` table:
     - Create space with category name? Or all in one default space?
     - **Option A:** Create a default space "Library" and put all migrated collections there
     - **Option B:** Each category becomes its own space (would be weird)
     - **Decision:** **Option A** — create "Library" space, all old categories → collections in Library
   - Preserve: category id → collection id (same UUID), name, icon, color, parent relationships

4. **Migrate bookmarks to collections**
   - For each bookmark with `category_id`:
     - Insert into `bookmark_collections` (bookmark_id, collection_id=bookmark.category_id)
   - For bookmarks with NULL category → add to Inbox collection

5. **Cleanup** (optional, after verification):
   - Keep old `categories` table for now (can drop in future version)

### Migration Pseudocode

```javascript
// In db.ts or migration script
const runMigration = () => {
  // Check if already migrated
  const already = db.prepare("SELECT 1 FROM spaces WHERE id = 'inbox-space'").get();
  if (already) return; // skip

  db.transaction(() => {
    // 1. Create spaces table if not exists
    db.exec(/* spaces DDL */);
    // 2. Create collections table if not exists
    db.exec(/* collections DDL */);
    // 3. Create bookmark_collections table if not exists
    db.exec(/* bookmark_collections DDL */);

    // 4. Create Inbox space
    db.prepare("INSERT OR IGNORE INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)")
      .run('inbox-space', 'Inbox', 'Inbox', '#6b7280');

    // 5. Create Inbox collection
    db.prepare("INSERT OR IGNORE INTO collections (id, name, icon, color, space_id) VALUES (?, ?, ?, ?, ?)")
      .run('inbox-collection', 'Inbox', 'Inbox', '#6b7280', 'inbox-space');

    // 6. Get all old categories
    const oldCats = db.prepare("SELECT * FROM categories").all();

    // 7. Create "Library" space
    const librarySpaceId = uuidv4();
    db.prepare("INSERT INTO spaces (id, name, icon, color) VALUES (?, ?, ?, ?)")
      .run(librarySpaceId, 'Library', 'Library', '#3b82f6');

    // 8. Migrate categories to collections, preserve IDs
    for (const cat of oldCats) {
      db.prepare(`
        INSERT OR IGNORE INTO collections (id, name, icon, color, space_id, parent_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(cat.id, cat.name, cat.icon, cat.color, librarySpaceId, cat.parent_id, cat.created_at);
    }

    // 9. Create bookmark_collections links
    const bookmarks = db.prepare("SELECT id, category_id FROM bookmarks WHERE is_deleted = 0").all();
    for (const b of bookmarks) {
      if (b.category_id) {
        db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)")
          .run(b.id, b.category_id);
      } else {
        // Add to Inbox
        db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)")
          .run(b.id, 'inbox-collection');
      }
    }

    // 10. Optionally mark migration complete
  })();
};
```

**Where to run migration:**
- In `db.ts` after creating `db` instance
- Idempotent (check by presence of `inbox-space`)

---

## 🔌 Backend API Changes

### New Endpoints

#### Spaces

- `GET /api/spaces` — list all spaces (with optional stats)
- `POST /api/spaces` — create space (body: { name, icon?, color? })
- `PUT /api/spaces/:id` — update space
- `DELETE /api/spaces/:id` — delete space (cascade → collections → unlink bookmarks)
- `GET /api/spaces/:id/collections` — list collections in space (optionally with tree)

#### Collections

- `GET /api/collections` — list all collections (optionally with tree/nesting)
  - Query: `?spaceId=` filter by space
- `POST /api/collections` — create collection
  - Body: { name, icon?, color?, space_id, parent_id? }
- `PUT /api/collections/:id` — update/rename/move
  - Body: { name?, icon?, color?, parent_id? }
- `DELETE /api/collections/:id` — delete collection (unlink bookmarks)

#### Bookmark ↔ Collection Associations

- `GET /api/bookmarks/:id/collections` — list collection IDs for bookmark
- `POST /api/bookmarks/:id/collections` — add bookmark to collection(s)
  - Body: { collectionIds: string[] }
- `DELETE /api/bookmarks/:id/collections/:collectionId` — remove from collection

#### Modified Endpoints

- `GET /api/bookmarks`
  - Remove: `categoryId` param
  - Add: `collectionIds=` (comma-separated) — filter bookmarks belonging to ANY of these collections
  - Also support `spaceId=` — all bookmarks from collections in that space (recursive)
- `POST /api/bookmarks`
  - Add optional body: `collectionIds: string[]`
  - If not provided, add to Inbox collection automatically
- `POST /api/bookmarks/categorize-all`
  - Now uses categorization service which assigns collection(s)
  - After categorization, bookmarks moved from Inbox to assigned collections
  - Option: keep in Inbox if categorization fails? Or leave as-is

#### Deprecated but Compatible

- `GET /api/categories` 
  - **Option:** Return collections mapped to old Category format for UI compatibility
  - OR: rewrite frontend to use new endpoints

### Updated CategorizationService

**New behavior:**

```typescript
categorizeBookmark(bookmarkId: string, force = false) => {
  // ... get bookmark
  // Use AI or local heuristics

  // Result returns:
  {
    success: true,
    collectionIds: string[], // one or more collection IDs (may include new ones)
    source: 'llm' | 'local',
    tags?: string[]
  }

  // After getting collection IDs:
  // 1. Ensure collections exist (create if missing in default space?)
  // 2. Insert links into bookmark_collections
  // 3. Remove from Inbox collection (if present)
}
```

**Heuristics strategy** returns collection names (or IDs if existing).
- If collection not found, create in "Library" space? Or a configured default space.
- Better: heuristics rule maps domain → collection name. Search across all spaces for matching collection name, create in first space with matching parent or Library.

---

## 🖥️ Frontend Changes

### Types

```typescript
// src/types.ts
export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  collectionCount?: number; // computed
}

export interface Collection {
  id: string;
  name: string;
  icon: string;
  color: string;
  space_id: string;
  parent_id: string | null;
  created_at: string;
  bookmarkCount?: number; // computed
  children?: Collection[]; // for tree rendering
}

export interface Bookmark {
  // ... existing fields
  collections?: Collection[]; // added
}
```

### Sidebar (`App.tsx`)

New structure:

```
- Spaces (expandable)
  - Inbox (special, pinned to top?)
  - [User Space 1]
      - Collection A
          - Subcollection A1
      - Collection B
  - [User Space 2]
      - ...
- Uncategorized (optional: bookmarks with no collections) — maybe removed if Inbox handles all
- Pinned Collections (if we support pinning)
- Domains/Resources (keep as is)
```

**Implementation:**

- State: `spaces: Space[]`, `collections: Collection[]`
- Fetch on load: `GET /api/spaces` and build tree with `GET /api/collections?tree=true`
- Render:
  ```tsx
  {spaces.map(space => (
    <CollapsibleSection key={space.id} title={space.name} icon={space.icon}>
      {space.collections.map(renderCollectionTree)}
    </CollapsibleSection>
  ))}
  ```
- Clicking collection → filters bookmarks by that collection (and subcollections recursively)
  - Need recursive query: all bookmark IDs in collection + descendants
  - API already supports tree with CTE (like categories)

- "Inbox" section:
  - Always visible, maybe at top
  - Shows count of bookmarks with Inbox collection
  - Click → show bookmarks in Inbox

### Bookmark Card & Detail

- Show collection badges (multiple)
  - In card: small badges with icon+color (Raindrop shows small circles)
  - In detail: section "Collections" with list, each removable
- Click collection badge → navigate to that collection (with focus on current bookmark)
  - Implementation: store in state `focusedBookmarkId` from query param

### Add Bookmark Modal

- Before: no collection selection (auto-categorization later)
- Now: **mandatory multi-select of collections** (using checkboxes or tags input)
- If user skips: automatically add to Inbox
  - Show warning "Add to Inbox" or provide quick-choose
- After adding: show success + assigned collections

### Bulk Actions

- Bulk add selected bookmarks to collection(s)
- Bulk remove from collection
- In collection view: bulk move to another collection

### Settings Modal

- Domain heuristics UI remains similar, but now maps domain → collection name (not category)
- Space selection for heuristics? Or just collection name (search globally)

---

## 🧠 Categorization Service Updates

**New `ICategorizationResult`:**

```typescript
interface CategorizationResult {
  collectionIds?: string[]; // suggested collection IDs (existing) OR
  collectionNames?: string[]; // names to create (in default space)
  // OR hybrid: [{name, spaceId?}]
  tags?: string[];
}
```

**Strategy implementations:**
- `OpenRouterStrategy`: Prompt AI to suggest 1-3 collection names (multi-label)
- `LocalHeuristicsStrategy`: Return single collection name from rules

**After categorization:**
1. For each collection name:
   - Find collection by name (in all spaces or default space)
   - If not found → create in "Library" space (or user's default)
   - Collect IDs
2. Create bookmark_collections links
3. Remove from Inbox (if present)

---

## 🔄 Migration Script Details

**File:** `server/migrations/migrate-to-spaces.ts` (or inline in `db.ts`)

**Idempotency:**
- Check for spaces table existence
- Check for specific seed `inbox-space` existence
- If already migrated, skip

**Data preservation:**
- Keep old `categories` table until confirmed migration OK
- Map:
  - `categories.id` → `collections.id` (same UUID)
  - `categories.name` → `collections.name`
  - `categories.icon, color` → same
  - `categories.parent_id` → same
  - `categories.created_at` → same
  - `bookmarks.category_id` → `bookmark_collections.collection_id`

**Statistics to log:**
- Number of spaces created
- Number of collections migrated
- Number of bookmark-collection links created
- Number of bookmarks added to Inbox

---

## 📋 Phase-by-Phase Implementation

### Phase 1: Database Schema
- [ ] Add spaces/collections/bookmark_collections DDL to `db.ts`
- [ ] Write migration function, test on sample DB
- [ ] Run migration on existing dev DB

### Phase 2: Backend API - Spaces & Collections
- [ ] GET `/api/spaces`
- [ ] POST `/api/spaces`
- [ ] PUT `/api/spaces/:id`
- [ ] DELETE `/api/spaces/:id`
- [ ] GET `/api/collections` (with & without space filter)
- [ ] POST `/api/collections`
- [ ] PUT `/api/collections/:id`
- [ ] DELETE `/api/collections/:id`
- [ ] Test with Postman/curl

### Phase 3: Bookmark Association APIs
- [ ] GET `/api/bookmarks/:id/collections`
- [ ] POST `/api/bookmarks/:id/collections`
- [ ] DELETE `/api/bookmarks/:id/collections/:collectionId`
- [ ] Modify `GET /api/bookmarks` to use `collectionIds` filter
- [ ] Modify `POST /api/bookmarks` to accept `collectionIds`

### Phase 4: Categorization Service
- [ ] Update `CategorizationService` to return collection IDs
- [ ] Update `OpenRouterStrategy.prompt` to ask for 1-3 collections
- [ ] Update `LocalHeuristicsStrategy` to return collection name
- [ ] Rewrite `categorizeBookmark` to create links in `bookmark_collections`
- [ ] Test with AI disabled/enabled

### Phase 5: Frontend - Types & API Client
- [ ] Update `src/types.ts` with Space, Collection, Bookmark.collections
- [ ] Add API functions in a service file (or inline) to call new endpoints
- [ ] Update `useEffect` in `App.tsx` to fetch spaces + collections instead of categories

### Phase 6: Frontend - Sidebar
- [ ] Build Spaces tree component
- [ ] Handle Inbox special display
- [ ] Implement collection navigation state
- [ ] Add count badges
- [ ] Recursive rendering of nested collections

### Phase 7: Frontend - Bookmark UI
- [ ] Update `BookmarkCard` to show collection badges
- [ ] Update `BookmarkDetail` to show/edit collections (multi-select)
- [ ] Update `AddBookmarkModal` for collection multi-select
  - Use checkboxes or token-input style
  - Default: if nothing selected → show warning "Add to Inbox?" (auto-select Inbox)
  - Or require selection, but Inbox always selectable
- [ ] Add "Add to Collection" bulk action

### Phase 8: Settings & Heuristics
- [ ] Update Domain Rules UI: domain → collection (autocomplete by collection name)
- [ ] Add space selector optional? Maybe just collection name (searches all)
- [ ] Test heuristics: add youtube.com → auto-add to "Videos" collection

### Phase 9: Testing & Polish
- [ ] Manual test: create spaces, collections, nested collections
- [ ] Test: add bookmark with multiple collections
- [ ] Test: navigation with cross-space bookmarks
- [ ] Test: Inbox auto-assignment
- [ ] Test: categorization adds to right collection and removes from Inbox
- [ ] Check counts, recursive filtering
- [ ] Verify migration on fresh + existing DB

### Phase 10: Decommission & Cleanup
- [ ] Keep `GET /api/categories` as alias to `/api/collections` (return old format)
- [ ] Add deprecation warning in console
- [ ] Remove old code after 1-2 releases (optional)

---

## ⚠️ Important Considerations

**Collection uniqueness:**
- Are collection names unique globally? Or per space?
- **Decision:** Collection names unique **within a space** (like Raindrop: space/collection path is unique)
- So you can have "Work/Dev" and "Personal/Dev" — allowed
- Heuristics by name only: need to specify "space/collection" or pick first match

**Inbox space:**
- Should "Inbox" be a separate space or just a collection in each space?
- **Decision:** One global "Inbox" collection (not in any user space)
- In sidebar: show as top-level item (not under any space heading)

**Bookmarks in multiple collections:**
- When filtering by collection A, show bookmarks that belong to A OR to its descendants
- If bookmark belongs to collection B in another space, it's NOT shown unless B is in A's tree
- Cross-space: bookmark appears in multiple filtered views (one per space/collection)

**Deleting spaces/collections:**
- Delete space → cascade delete collections → unlink bookmarks (but keep bookmarks)
- Delete collection → unlink bookmarks only (not delete)
- If bookmark loses all collections → add back to Inbox automatically

**Moving collections:**
- Change `space_id` or `parent_id` → no effect on bookmarks (they stay linked)

---

## 📎 Open Questions

1. **Should Inbox collection be deletable?** No, system-protected.
2. **Can user create their own "Inbox" collection?** Possible conflict → prevent naming?
3. **How to handle heuristics when collection exists in multiple spaces?** Pick first (alphabetically) or show disambiguation?
4. **Stats in sidebar:** show counts (bookmarks per collection)? Yes, but may impact performance (need extra queries). Could compute on demand.

---

## 🎯 Success Criteria

- [ ] Migration runs on first launch without errors
- [ ] All existing bookmarks appear in appropriate collections (Library space or Inbox)
- [ ] User can create Space → Collection → Subcollection
- [ ] User can add bookmark to 1+ collections
- [ ] Clicking collection shows only bookmarks in that collection tree
- [ ] Inbox auto-lands new bookmarks
- [ ] Domain heuristics auto-assign to collection (if name matches)
- [ ] UI clearly shows which collections a bookmark belongs to
- [ ] Navigation from bookmark card to collection works with focus
- [ ] AI categorization (when enabled) assigns collection correctly

---

**Next Step:** Begin Phase 1 (Database Schema) implementation.

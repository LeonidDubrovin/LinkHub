import db from "../db.js";
import { getConfig } from "../config.js";
import { CategorizationStrategyFactory } from "./llm/factory.js";
import { BookmarkData, CategorizationResult, ICategorizationStrategy, CategorizationServiceResult } from "./llm/interfaces.js";
import { LocalHeuristicsStrategy } from "./llm/local-heuristics.strategy.js";
import { v4 as uuidv4 } from "uuid";

export class CategorizationService {
  private llmStrategy: ICategorizationStrategy | null = null;
  private localStrategy: ICategorizationStrategy;
  private config: any;

  constructor() {
    this.config = getConfig();
    this.localStrategy = new LocalHeuristicsStrategy();
    this.initLLM();
  }

  private initLLM(): void {
    const llmConfig = this.config.llm;
    if (llmConfig?.enabled && llmConfig.apiKey) {
      try {
        this.llmStrategy = CategorizationStrategyFactory.create(llmConfig);
      } catch (e) {
        console.error("Failed to initialize LLM strategy:", e.message);
        this.llmStrategy = null;
      }
    }
  }

   async categorizeBookmark(bookmarkId: string, force: boolean = false): Promise<CategorizationServiceResult> {
     // 1. Get bookmark
     const bookmark = db.prepare("SELECT * FROM bookmarks WHERE id = ?").get(bookmarkId) as any;
     if (!bookmark) {
       return { success: false, source: null, tags: [], error: "Bookmark not found" };
     }

     // 2. Check if already categorized (has category_id) and not forcing
     if (!force && bookmark.category_id) {
       return { 
         success: true, 
         source: bookmark.categorization_source as any || 'manual', 
         tags: [], 
         error: null 
       };
     }

     // 3. Prepare data
     const bookmarkData: BookmarkData = {
       id: bookmark.id,
       url: bookmark.url,
       title: bookmark.title,
       description: bookmark.description,
       domain: bookmark.domain,
       content_text: bookmark.content_text
     };

     // 4. Try LLM if configured
     let result: CategorizationResult | null = null;
     let source: 'llm' | 'local' | null = null;

     if (this.llmStrategy && this.config.llm?.enabled) {
       try {
         result = await this.llmStrategy.categorize(bookmarkData);
         source = 'llm';
       } catch (error: any) {
         console.warn(`LLM categorization failed for ${bookmarkId}:`, error.message);
         result = null;
       }
     }

     // 5. Fallback to local heuristics if LLM failed or not configured
     if (!result && this.config.localHeuristics?.enabled) {
       result = await this.localStrategy.categorize(bookmarkData);
       source = 'local';
     }

     // 6. If still no result, return uncategorized (keep in Inbox)
     if (!result || (!result.collectionIds && !result.collectionNames)) {
       return {
         success: false,
         source: null,
         tags: [],
         error: "Could not determine collection"
       };
     }

     // 7. Resolve collection IDs
     let collectionIds: string[] = [];
     
     if (result.collectionIds && result.collectionIds.length > 0) {
       collectionIds = result.collectionIds;
     } else if (result.collectionNames && result.collectionNames.length > 0) {
       // Resolve each collection name to an ID (create if needed)
       for (const name of result.collectionNames) {
         // Try to find collection by name (case-insensitive) across all spaces
         const existing = db.prepare("SELECT id FROM collections WHERE LOWER(name) = LOWER(?) LIMIT 1").get(name) as any;
         if (existing) {
           collectionIds.push(existing.id);
         } else {
           // Create new collection in "Library" space
           const librarySpace = db.prepare("SELECT id FROM spaces WHERE name = 'Library' LIMIT 1").get() as any;
           if (!librarySpace) {
             throw new Error("Library space not found");
           }
           const newId = uuidv4();
           const color = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
           db.prepare(
             "INSERT INTO collections (id, name, icon, color, space_id, parent_id) VALUES (?, ?, ?, ?, ?, ?)"
           ).run(newId, name, "Folder", color, librarySpace.id, null);
           collectionIds.push(newId);
         }
       }
     }

     if (collectionIds.length === 0) {
       return { success: false, source: null, tags: [], error: "No collections resolved" };
     }

     // 8. Remove old collection links (including Inbox) and add new ones
     db.prepare("DELETE FROM bookmark_collections WHERE bookmark_id = ?").run(bookmarkId);
     
     const insertLink = db.prepare("INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)");
     for (const colId of collectionIds) {
       insertLink.run(bookmarkId, colId);
     }

     // 9. Update bookmark with first collection as legacy category_id for backward compatibility
     db.prepare(
       "UPDATE bookmarks SET category_id = ?, categorization_at = ?, categorization_source = ? WHERE id = ?"
     ).run(collectionIds[0], new Date().toISOString(), source, bookmarkId);

     // 10. Process tags: create and link
     const tagIds: string[] = [];
     for (const tagName of result.tags) {
       let tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as any;
       let tagId;
       if (!tag) {
         tagId = uuidv4();
         db.prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)").run(tagId, tagName);
         tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(tagName) as any;
         if (tag) tagId = tag.id;
       } else {
         tagId = tag.id;
       }
       tagIds.push(tagId);
       
       // Link bookmark to tag (avoid duplicates)
       db.prepare("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)").run(bookmarkId, tagId);
     }

     return {
       success: true,
       source,
       collectionIds,
       tags: result.tags
     };
   }

  async categorizeAll(onlyUntagged: boolean = true): Promise<{total: number, processed: number, failed: number, errors: string[]}> {
    let query = "SELECT id FROM bookmarks WHERE is_deleted = 0 AND category_id IS NULL";
    const params: any[] = [];
    
    if (onlyUntagged) {
      // Already in query
    }

    const bookmarks = db.prepare(query).all(...params) as { id: string }[];
    
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const b of bookmarks) {
      try {
        const result = await this.categorizeBookmark(b.id, false);
        if (result.success) {
          processed++;
        } else {
          failed++;
          errors.push(`Bookmark ${b.id}: ${result.error}`);
        }
      } catch (error: any) {
        failed++;
        errors.push(`Bookmark ${b.id}: ${error.message}`);
      }

      // Rate limiting delay if configured
      const delay = this.config.llm?.rateLimitDelay || 0;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return { total: bookmarks.length, processed, failed, errors };
  }

  async getStats(): Promise<{total: number, categorized: number, uncategorized: number, bySource: Record<string, number>}> {
    const total = db.prepare("SELECT COUNT(*) as count FROM bookmarks WHERE is_deleted = 0").get().count;
    const categorized = db.prepare("SELECT COUNT(*) as count FROM bookmarks WHERE is_deleted = 0 AND category_id IS NOT NULL").get().count;
    const uncategorized = total - categorized;
    
    const bySource: Record<string, number> = {};
    const rows = db.prepare("SELECT categorization_source, COUNT(*) as count FROM bookmarks WHERE is_deleted = 0 AND categorization_source IS NOT NULL GROUP BY categorization_source").all();
    for (const row of rows as any[]) {
      bySource[row.categorization_source] = row.count;
    }

    return { total, categorized, uncategorized, bySource };
  }
}

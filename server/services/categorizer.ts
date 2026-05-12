import { getDb } from "../db.ts";
import { getConfig } from "../config.ts";
import { CategorizationStrategyFactory } from "./llm/factory.ts";
import { BookmarkData, CategorizationResult, ICategorizationStrategy, CategorizationServiceResult } from "./llm/interfaces.ts";
import { LocalHeuristicsStrategy } from "./llm/local-heuristics.strategy.ts";
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
      } catch (e: any) {
        console.error("Failed to initialize LLM strategy:", e.message);
        this.llmStrategy = null;
      }
    }
  }

   async categorizeBookmark(bookmarkId: string, force: boolean = false): Promise<CategorizationServiceResult> {
      const db = await getDb();
      const bookmark = (await db.get("SELECT * FROM bookmarks WHERE id = ?", bookmarkId)) as any;
      if (!bookmark) {
        return { success: false, source: null, tags: [], error: "Bookmark not found" };
      }

      const hasCollections = (await db.get("SELECT 1 FROM bookmark_collections WHERE bookmark_id = ? LIMIT 1", bookmarkId)) as any;
      if (!force && hasCollections) {
        return {
          success: true,
          source: bookmark.categorization_source as any || 'manual',
          tags: [],
          error: null
        };
      }

      const bookmarkData: BookmarkData = {
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description,
        domain: bookmark.domain,
        content_text: bookmark.content_text
      };

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

      if (!result && this.config.localHeuristics?.enabled) {
        result = await this.localStrategy.categorize(bookmarkData);
        source = 'local';
      }

      if (!result || (!result.collectionIds && !result.collectionNames)) {
        return {
          success: false,
          source: null,
          tags: [],
          error: "Could not determine collection"
        };
      }

      let collectionIds: string[] = [];
      
      if (result.collectionIds && result.collectionIds.length > 0) {
        collectionIds = result.collectionIds;
      } else if (result.collectionNames && result.collectionNames.length > 0) {
        for (const name of result.collectionNames) {
          const existing = (await db.get("SELECT id FROM collections WHERE LOWER(name) = LOWER(?) LIMIT 1", name)) as any;
          if (existing) {
            collectionIds.push(existing.id);
          } else {
             const defaultSpace = (await db.get("SELECT id FROM spaces WHERE id = 'inbox-space' LIMIT 1")) as any;
             if (!defaultSpace) {
               throw new Error("Default space not found");
             }
             const newId = uuidv4();
             const color = "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
             await db.run(
               "INSERT INTO collections (id, name, icon, color, space_id, parent_id) VALUES (?, ?, ?, ?, ?, ?)",
               newId, name, "Folder", color, defaultSpace.id, null
             );
            collectionIds.push(newId);
          }
        }
      }

      if (collectionIds.length === 0) {
        return { success: false, source: null, tags: [], error: "No collections resolved" };
      }

       await db.run("DELETE FROM bookmark_collections WHERE bookmark_id = ?", bookmarkId);

       for (const colId of collectionIds) {
         await db.run(
           "INSERT OR IGNORE INTO bookmark_collections (bookmark_id, collection_id) VALUES (?, ?)",
           bookmarkId, colId
         );
       }

       await db.run(
         "UPDATE bookmarks SET categorization_at = ?, categorization_source = ? WHERE id = ?",
         new Date().toISOString(), source, bookmarkId
       );

      const tagIds: string[] = [];
      for (const tagName of result.tags) {
        let tag = (await db.get("SELECT id FROM tags WHERE name = ?", tagName)) as any;
        let tagId: string;
        if (!tag) {
          tagId = uuidv4();
          await db.run("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)", tagId, tagName);
          tag = (await db.get("SELECT id FROM tags WHERE name = ?", tagName)) as any;
          if (tag) tagId = tag.id;
        } else {
          tagId = tag.id;
        }
        tagIds.push(tagId);
        await db.run("INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)", bookmarkId, tagId);
      }

      return {
        success: true,
        source,
        collectionIds,
        tags: result.tags
      };
    }

   async categorizeAll(onlyUntagged: boolean = true): Promise<{total: number, processed: number, failed: number, errors: string[]}> {
     const db = await getDb();
     let query = `SELECT id FROM bookmarks WHERE is_deleted = 0 AND NOT EXISTS (SELECT 1 FROM bookmark_collections bc WHERE bc.bookmark_id = bookmarks.id)`;
     const params: any[] = [];

     if (onlyUntagged) {
       // Already in query
     }

     const bookmarks = (await db.all(query, ...params)) as { id: string }[];
     
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

       const delay = this.config.llm?.rateLimitDelay || 0;
       if (delay > 0) {
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }

     return { total: bookmarks.length, processed, failed, errors };
   }

   async getStats(): Promise<{total: number, categorized: number, uncategorized: number, bySource: Record<string, number>}> {
     const db = await getDb();
     const totalRow = (await db.get("SELECT COUNT(*) as count FROM bookmarks WHERE is_deleted = 0")) as any;
     const total = totalRow?.count ?? 0;
     const categorizedRow = (await db.get(`SELECT COUNT(*) as count FROM bookmarks b WHERE is_deleted = 0 AND EXISTS (SELECT 1 FROM bookmark_collections bc WHERE bc.bookmark_id = b.id)`)) as any;
     const categorized = categorizedRow?.count ?? 0;
     const uncategorized = total - categorized;

     const bySource: Record<string, number> = {};
     const rows = (await db.all("SELECT categorization_source, COUNT(*) as count FROM bookmarks WHERE is_deleted = 0 AND categorization_source IS NOT NULL GROUP BY categorization_source")) as any[];
     for (const row of rows) {
       bySource[row.categorization_source] = row.count;
     }

     return { total, categorized, uncategorized, bySource };
   }
}

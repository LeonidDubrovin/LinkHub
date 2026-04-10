import { getConfig } from "../../config.ts";
import { BookmarkData, CategorizationResult, ICategorizationStrategy } from "./interfaces.ts";

export class LocalHeuristicsStrategy implements ICategorizationStrategy {
  getName(): string {
    return "Local Heuristics";
  }

   async categorize(data: BookmarkData): Promise<CategorizationResult> {
     const config = getConfig();
     const rules = (config.localHeuristics?.domainCategoryRules as Record<string, string>) || {};

     if (!data.domain) {
       return { tags: [] };
     }

     // Try exact domain match
     const collectionName = rules[data.domain] || rules[`www.${data.domain}`];

     if (collectionName) {
       return {
         collectionNames: [collectionName],
         tags: []
       };
     }

     // Try suffix matching (e.g., youtube.com matches *.youtube.com)
     for (const [ruleDomain, collection] of Object.entries(rules)) {
       if (data.domain.endsWith(ruleDomain) && data.domain !== ruleDomain) {
         return {
           collectionNames: [collection],
           tags: []
         };
       }
     }

     return { tags: [] };
   }

  async testConnection(): Promise<boolean> {
    // Local heuristics always "connected"
    return true;
  }
}

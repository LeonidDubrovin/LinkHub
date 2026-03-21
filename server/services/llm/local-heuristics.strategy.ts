import { getConfig } from "../../config.js";
import { BookmarkData, CategorizationResult, ICategorizationStrategy } from "./interfaces.js";

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
    const categoryName = rules[data.domain] || rules[`www.${data.domain}`];

    if (categoryName) {
      return {
        categoryId: undefined, // Will be resolved by categorizer
        newCategoryName: categoryName,
        parentCategoryId: undefined,
        tags: []
      };
    }

    // Try suffix matching (e.g., youtube.com matches *.youtube.com)
    for (const [ruleDomain, category] of Object.entries(rules)) {
      if (data.domain.endsWith(ruleDomain) && data.domain !== ruleDomain) {
        return {
          categoryId: undefined,
          newCategoryName: category,
          parentCategoryId: undefined,
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

import db from "../../db.js";
import { getConfig } from "../../config.js";
import { BookmarkData, CategorizationResult, ICategorizationStrategy, LLMConfig } from "./interfaces.js";

export class OpenRouterStrategy implements ICategorizationStrategy {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  getName(): string {
    return `OpenRouter (${this.config.model})`;
  }

  async categorize(data: BookmarkData): Promise<CategorizationResult> {
    // Fetch existing categories from DB
    const categories = db.prepare("SELECT id, name FROM categories").all() as { id: string; name: string }[];
    const categoryNames = categories.map(c => c.name);

    const prompt = `
You are a bookmark categorization assistant. Analyze the web page and assign it to an appropriate category and tags.

Existing categories: ${JSON.stringify(categoryNames)}

Bookmark:
- URL: ${data.url}
- Title: ${data.title || ''}
- Description: ${data.description || ''}
- Content snippet: ${(data.content_text || '').substring(0, 2000)}

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
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://linkhub.app", // Optional
        "X-Title": "LinkHub" // Optional
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: "You are a helpful assistant that categorizes bookmarks." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 512
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenRouter");
    }

    let json: any;
    try {
      json = JSON.parse(content);
    } catch (e) {
      throw new Error("Invalid JSON response from LLM");
    }

    // Validate and normalize
    const tags = Array.isArray(json.tags) ? json.tags.map((t: string) => t.toLowerCase().trim()) : [];

    // Resolve categoryId: if newCategoryName is provided, we'll create it later
    let categoryId: string | undefined = json.categoryId || undefined;
    let newCategoryName: string | undefined = json.newCategoryName
      ? String(json.newCategoryName).trim()
      : undefined;

    // If categoryId doesn't exist in DB, treat as new category name
    if (categoryId) {
      const exists = db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId);
      if (!exists) {
        newCategoryName = categoryId; // LLM might have returned name instead of id
        categoryId = undefined;
      }
    }

    return {
      categoryId,
      newCategoryName,
      parentCategoryId: json.parentCategoryId || undefined,
      tags
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }
}

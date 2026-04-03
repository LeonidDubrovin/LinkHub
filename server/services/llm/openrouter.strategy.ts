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
     // Fetch existing collection names from DB
     const collections = db.prepare("SELECT id, name FROM collections").all() as { id: string; name: string }[];
     const collectionNames = collections.map(c => c.name);

     const prompt = `
You are a bookmark categorization assistant. Analyze the web page and assign it to appropriate collections and tags.

Existing collections: ${JSON.stringify(collectionNames)}

Bookmark:
- URL: ${data.url}
- Title: ${data.title || ''}
- Description: ${data.description || ''}
- Content snippet: ${(data.content_text || '').substring(0, 2000)}

Task:
1. Suggest 1-3 collection names. These can be existing collections from the list OR new collection names. If using existing, match name exactly as provided. Prefer existing if they fit well.
2. Suggest 3-5 relevant tags (lowercase, single words, no spaces).

Return strictly valid JSON:
{
  "collectionNames": ["collection1", "collection2", ...],
  "tags": ["tag1", "tag2", ...]
}
`;

     const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
       method: "POST",
       headers: {
         "Authorization": `Bearer ${this.config.apiKey}`,
         "Content-Type": "application/json",
         "HTTP-Referer": "https://linkhub.app",
         "X-Title": "LinkHub"
       },
       body: JSON.stringify({
         model: this.config.model,
         messages: [
           { role: "system", content: "You are a helpful assistant that categorizes bookmarks into collections." },
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
     const collectionNamesResp = Array.isArray(json.collectionNames) ? json.collectionNames.map((c: string) => String(c).trim()) : [];

     return {
       collectionNames: collectionNamesResp,
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

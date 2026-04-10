import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import db from "../db.ts";
import { getConfig } from "../config.ts";

export async function categorizeWithAI(
  url: string,
  title: string,
  description: string,
  content_text: string
) {
  let category_id: string | null = null;
  let suggestedTags: string[] = [];

  const config = getConfig();
  const provider = config.llmProvider || "gemini";
  const apiKey = config.llmApiKey || process.env.GEMINI_API_KEY;
  const model = config.llmModel || "gemini-3-flash-preview";
  const endpoint = config.llmEndpoint || "";

  if (!apiKey && provider !== "custom") {
    console.warn("No API key configured for AI categorization.");
    return { category_id, suggestedTags };
  }

  try {
    const categories = db
      .prepare("SELECT id, name, parent_id FROM categories")
      .all() as any[];
    const existingTags = db.prepare("SELECT name FROM tags").all().map((t: any) => t.name);

    const prompt = `
      Analyze this web page to categorize it and extract tags.
      
      URL: ${url}
      Title: ${title}
      Description: ${description}
      Content Snippet: ${content_text.substring(0, 3000)}
      
      Existing categories: ${JSON.stringify(categories)}
      Existing tags: ${JSON.stringify(existingTags)}
      
      Task:
      1. Categorize this bookmark. Strongly prefer using an existing category ID if it fits reasonably well. Only suggest a new category name if the topic is completely unrepresented in the existing categories.
      2. If suggesting a new category, try to assign it to an existing parent_id to create a logical nested hierarchy.
      3. Suggest 3-5 highly relevant tags that describe the specific topic, technology, or entity discussed. Strongly prefer using existing tags if they fit, to avoid duplicates (e.g., prefer 'react' over 'reactjs' if 'react' exists).
      
      Specific Rules:
      - If the URL is from youtube.com or youtu.be (whether it's a channel, video, or playlist), categorize it under a "Video" or "Videos" category (create one if it doesn't exist).
      - If the URL is from steamcommunity.com, store.steampowered.com, or itch.io, categorize it under a "Games" or "Gaming" category (create one if it doesn't exist).

      Return the result as a JSON object with the following structure:
      {
        "categoryId": "ID of an existing category, if it fits perfectly (optional)",
        "newCategoryName": "Name of a new category to create, if no existing one fits (optional)",
        "parentCategoryId": "If creating a new category, the ID of an existing category to nest it under (optional)",
        "tags": ["tag1", "tag2", "tag3"]
      }
    `;

    let jsonText = "{}";

    if (provider === "gemini") {
      const ai = new GoogleGenAI({ apiKey: apiKey as string });
      const aiResponse = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categoryId: { type: Type.STRING, description: "ID of an existing category, if it fits perfectly." },
              newCategoryName: { type: Type.STRING, description: "Name of a new category to create, if no existing one fits." },
              parentCategoryId: { type: Type.STRING, description: "If creating a new category, the ID of an existing category to nest it under (optional)." },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });
      try {
        jsonText = aiResponse.text || "{}";
      } catch (textErr) {
        console.warn("Gemini response text blocked or unavailable:", textErr);
      }
    } else if (provider === "openai" || provider === "custom") {
      const openaiConfig: any = { apiKey: apiKey || "dummy-key" };
      if (provider === "custom" && endpoint) {
        openaiConfig.baseURL = endpoint;
      }
      const openai = new OpenAI(openaiConfig);
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      jsonText = response.choices[0]?.message?.content || "{}";
    } else if (provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: apiKey as string });
      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt + "\n\nReturn ONLY valid JSON." }],
      });
      jsonText = (response.content[0] as any).text || "{}";
    }

    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonText = jsonMatch[1];
    } else {
      // Fallback: try to find the first { and last }
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
      }
    }
    
    const result = JSON.parse(jsonText);

    if (result.categoryId) {
      const exists = db.prepare("SELECT id FROM categories WHERE id = ?").get(result.categoryId);
      if (exists) {
        category_id = result.categoryId;
      }
    }
    
    if (!category_id && result.newCategoryName && typeof result.newCategoryName === 'string' && result.newCategoryName.trim() !== '') {
      const newName = result.newCategoryName.trim();
      // Re-query the database to avoid race conditions after the async AI call
      const existingCategory = db.prepare("SELECT id FROM categories WHERE LOWER(name) = ?").get(newName.toLowerCase()) as any;
      
      if (existingCategory) {
        category_id = existingCategory.id;
      } else {
        category_id = uuidv4();
        const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        let parent_id = null;
        if (result.parentCategoryId) {
          const parentExists = db.prepare("SELECT id FROM categories WHERE id = ?").get(result.parentCategoryId);
          if (parentExists) {
            parent_id = result.parentCategoryId;
          }
        }
        db.prepare(
          "INSERT INTO categories (id, name, icon, color, parent_id) VALUES (?, ?, ?, ?, ?)"
        ).run(category_id, newName, "Folder", color, parent_id);
      }
    }

    if (result.tags && Array.isArray(result.tags)) {
      suggestedTags = result.tags
        .filter((t: any) => typeof t === "string")
        .map((t: string) => t.toLowerCase());
    }
  } catch (e) {
    console.error("AI categorization failed:", e);
  }

  return { category_id, suggestedTags };
}

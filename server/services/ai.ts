import { GoogleGenAI, Type } from "@google/genai";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";

export async function categorizeWithAI(
  url: string,
  title: string,
  description: string,
  content_text: string
) {
  let category_id: string | null = null;
  let suggestedTags: string[] = [];

  if (!process.env.GEMINI_API_KEY) {
    return { category_id, suggestedTags };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
    `;

    const aiResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    let jsonText = aiResponse.text || "{}";
    jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    const result = JSON.parse(jsonText);

    if (result.categoryId && categories.find((c) => c.id === result.categoryId)) {
      category_id = result.categoryId;
    } else if (result.newCategoryName) {
      category_id = uuidv4();
      const color = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
      let parent_id = null;
      if (result.parentCategoryId && categories.find((c) => c.id === result.parentCategoryId)) {
        parent_id = result.parentCategoryId;
      }
      db.prepare(
        "INSERT INTO categories (id, name, icon, color, parent_id) VALUES (?, ?, ?, ?, ?)"
      ).run(category_id, result.newCategoryName, "Folder", color, parent_id);
    }

    if (result.tags && Array.isArray(result.tags)) {
      suggestedTags = result.tags.map((t: string) => t.toLowerCase());
    }
  } catch (e) {
    console.error("Gemini categorization failed:", e);
  }

  return { category_id, suggestedTags };
}

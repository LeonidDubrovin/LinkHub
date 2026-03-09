import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import * as tldts from "tldts";
import { categorizeWithAI } from "./ai.js";

export async function fetchBookmarkData(url: string) {
  // 1. Fetch HTML
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const html = await response.text();

  // 2. Extract Metadata
  const $ = cheerio.load(html);
  let title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    url;
  let description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";
  let cover_image_url = $('meta[property="og:image"]').attr("content") || "";
  const extractedImages = new Set<string>();

  // YouTube specific handling
  if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
    try {
      let videoId = null;
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
          videoId = urlObj.searchParams.get('v');
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        }
      } catch (e) {}

      if (videoId) {
        cover_image_url = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        extractedImages.add(cover_image_url);
        extractedImages.add(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
        extractedImages.add(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
      }

      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        title = oembedData.title || title;
        if (!videoId) {
          cover_image_url = oembedData.thumbnail_url || cover_image_url;
        }
        description = oembedData.author_name ? `Video by ${oembedData.author_name}` : description;
      }
    } catch (e) {
      console.error("Failed to fetch YouTube oembed", e);
    }
  }

  if (cover_image_url) extractedImages.add(cover_image_url);

  $("img").each((i, el) => {
    let src = $(el).attr("src");
    if (src) {
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) {
        try {
          src = new URL(src, url).href;
        } catch (e) {}
      }
      if (src.startsWith("http") && !src.includes("favicon") && !src.includes("icon") && !src.includes("logo") && !src.includes("spinner")) {
        extractedImages.add(src);
      }
    }
  });

  const images_json = JSON.stringify(Array.from(extractedImages).slice(0, 3));

  // 3. Extract Content for Reader View
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const content_text = article ? article.textContent : "";

  let domain = "";
  try {
    const parsed = tldts.parse(url);
    domain = parsed.domain || new URL(url).hostname;
  } catch (e) {}

  // 4. Smart Categorization with Gemini
  const { category_id, suggestedTags } = await categorizeWithAI(
    url,
    title,
    description,
    content_text
  );

  return {
    title,
    description,
    cover_image_url,
    images_json,
    content_text,
    category_id,
    domain,
    suggestedTags
  };
}

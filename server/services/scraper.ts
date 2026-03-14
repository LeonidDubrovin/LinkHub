import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import * as tldts from "tldts";
import { categorizeWithAI } from "./ai.js";

export async function fetchBookmarkData(url: string) {
  // 1. Fetch HTML
  // Use a bot User-Agent (like Twitterbot or Googlebot). Many sites (like Kinopoisk) 
  // block generic fetches but explicitly allow social bots to generate link previews.
  let html = "";
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Twitterbot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    html = await response.text();
  } catch (e) {
    console.error("Fetch failed with Twitterbot, trying generic...", e);
    try {
      const fallbackResponse = await fetch(url);
      html = await fallbackResponse.text();
    } catch (fallbackErr) {
      console.error("Fallback fetch failed", fallbackErr);
    }
  }

  // 2. Extract Metadata
  const $ = cheerio.load(html);
  let title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text() ||
    url;
  let description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";
  let cover_image_url = 
    $('meta[property="og:image"]').attr("content") || 
    $('meta[name="twitter:image"]').attr("content") || 
    "";
    
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

  // Extract multiple og:images if available
  $('meta[property="og:image"]').each((i, el) => {
    const content = $(el).attr("content");
    if (content) extractedImages.add(content);
  });

  $("img").each((i, el) => {
    let src = $(el).attr("src") || $(el).attr("data-src");
    if (src) {
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) {
        try {
          src = new URL(src, url).href;
        } catch (e) {}
      }
      
      const width = $(el).attr("width");
      const height = $(el).attr("height");
      const className = $(el).attr("class") || "";
      const alt = $(el).attr("alt") || "";
      
      const isJunk = 
        src.includes("favicon") || 
        src.includes("icon") || 
        src.includes("logo") || 
        src.includes("spinner") ||
        src.includes("avatar") ||
        src.includes("badge") ||
        src.includes("emoji") ||
        src.includes("tracker") ||
        src.includes("pixel") ||
        src.endsWith(".svg") ||
        src.endsWith(".gif") ||
        src.startsWith("data:image") ||
        className.toLowerCase().includes("logo") ||
        className.toLowerCase().includes("icon") ||
        alt.toLowerCase().includes("logo");
        
      const isTooSmall = (width && parseInt(width) < 100) || (height && parseInt(height) < 100);

      if (src.startsWith("http") && !isJunk && !isTooSmall) {
        extractedImages.add(src);
      }
    }
  });

  const images_json = JSON.stringify(Array.from(extractedImages).slice(0, 5));

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
    title: title.trim(),
    description: description.trim(),
    cover_image_url,
    images_json,
    content_text,
    category_id,
    domain,
    suggestedTags
  };
}

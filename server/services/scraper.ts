import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import * as tldts from "tldts";
import { categorizeWithAI } from "./ai.js";
import { getConfig } from "../config.js";

export async function fetchBookmarkData(url: string) {
  // 1. Fetch HTML
  // Use a bot User-Agent (like Twitterbot or Googlebot). Many sites (like Kinopoisk) 
  // block generic fetches but explicitly allow social bots to generate link previews.
  let html = "";
  const config = getConfig();
  const userAgent = config.userAgent || "Mozilla/5.0 (compatible; Twitterbot/1.0)";
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    html = await response.text();
  } catch (e) {
    console.error(`Fetch failed with ${userAgent}, trying generic...`, e);
    try {
      const fallbackResponse = await fetch(url);
      if (!fallbackResponse.ok && fallbackResponse.status !== 404) {
        throw new Error(`Fallback HTTP error! status: ${fallbackResponse.status}`);
      }
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

  if (cover_image_url) {
    try {
      cover_image_url = new URL(cover_image_url, url).href;
    } catch (e) {}
  }
    
  const extractedImages = new Set<string>();
  const MIN_IMAGE_SIZE = 100;

  // YouTube specific handling
  if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
    const result = await handleYouTubeMetadata(url, cover_image_url, extractedImages);
    cover_image_url = result.cover_image_url;
    title = result.title;
    description = result.description;
  }

  if (cover_image_url) extractedImages.add(cover_image_url);

  // Extract multiple og:images if available
  $('meta[property="og:image"]').each((i, el) => {
    const content = $(el).attr("content");
    if (content) {
      try {
        extractedImages.add(new URL(content, url).href);
      } catch (e) {}
    }
  });

  $("img").each((i, el) => {
    let src = $(el).attr("src") || $(el).attr("data-src");
    if (src) {
      try {
        src = new URL(src, url).href;
      } catch (e) {
        // If URL parsing fails, skip this image
        return;
      }

      const width = $(el).attr("width");
      const height = $(el).attr("height");
      const className = $(el).attr("class") || "";
      const alt = $(el).attr("alt") || "";

      const srcLower = src.toLowerCase();
      const classLower = className.toLowerCase();
      const altLower = alt.toLowerCase();

      const isJunk =
        srcLower.includes("favicon") ||
        srcLower.includes("icon") ||
        srcLower.includes("logo") ||
        srcLower.includes("spinner") ||
        srcLower.includes("avatar") ||
        srcLower.includes("badge") ||
        srcLower.includes("emoji") ||
        srcLower.includes("tracker") ||
        srcLower.includes("pixel") ||
        src.endsWith(".svg") ||
        src.endsWith(".gif") ||
        src.startsWith("data:image") ||
        classLower.includes("logo") ||
        classLower.includes("icon") ||
        altLower.includes("logo");

      const widthNum = width ? parseInt(width, 10) : NaN;
      const heightNum = height ? parseInt(height, 10) : NaN;
      const isTooSmall =
        (!isNaN(widthNum) && widthNum < MIN_IMAGE_SIZE) ||
        (!isNaN(heightNum) && heightNum < MIN_IMAGE_SIZE);

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

async function handleYouTubeMetadata(url: string, cover_image_url: string, extractedImages: Set<string>): Promise<{cover_image_url: string; title: string; description: string}> {
  let result = { cover_image_url, title: '', description: '' };
  try {
    let videoId = null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v');
        if (!videoId && urlObj.pathname.startsWith('/shorts/')) {
          videoId = urlObj.pathname.split('/')[2];
        }
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      }
    } catch (e) {}

    if (videoId) {
      const maxresUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const mqUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      result.cover_image_url = maxresUrl;
      extractedImages.add(maxresUrl);
      extractedImages.add(hqUrl);
      extractedImages.add(mqUrl);
    }

    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      result.title = oembedData.title || result.title;
      if (!videoId) {
        result.cover_image_url = oembedData.thumbnail_url || result.cover_image_url;
      }
      result.description = oembedData.author_name ? `Video by ${oembedData.author_name}` : result.description;
    }
  } catch (e) {
    console.error("Failed to fetch YouTube oembed", e);
  }
  return result;
}

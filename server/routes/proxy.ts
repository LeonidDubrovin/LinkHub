import express from "express";
import { getConfig } from "../config.js";

function isSafeProxyUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname === '0.0.0.0' || hostname.endsWith('.local')) return false;
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 127) return false;
      if (parts[0] === 169 && parts[1] === 254) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const router = express.Router();

router.get("/proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("URL is required");
  if (!isSafeProxyUrl(url)) return res.status(403).send("Access to internal addresses is not allowed");

  try {
    const config = getConfig();
    const userAgent = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    const headers: Record<string, string> = {
      "User-Agent": userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "X-Forwarded-For": "66.249.66.1",
    };
    if (req.headers.cookie) headers["Cookie"] = req.headers.cookie;

    const response = await fetch(url, { headers });
    if (typeof response.headers.getSetCookie === 'function') {
      const cookies = response.headers.getSetCookie();
      if (cookies && cookies.length > 0) res.setHeader("Set-Cookie", cookies);
    } else {
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) res.setHeader("Set-Cookie", setCookie);
    }

    const serverHeader = response.headers.get("server")?.toLowerCase() || "";
    const isCloudflare = serverHeader.includes("cloudflare");
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("text/html")) return res.redirect(url);

    let html = await response.text();
    const finalUrl = response.url || url;
    if (!isCloudflare || (response.status !== 403 && response.status !== 503)) {
      const baseTag = `<base href="${finalUrl}">`;
      if (/<head[^>]*>/i.test(html)) html = html.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
      else html = baseTag + "\n" + html;
    }
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error: any) {
    res.status(500).send(`Failed to load page: ${error.message}`);
  }
});

export default router;

import * as cheerio from "cheerio";
import https from "https";

async function getImageSize(url: string): Promise<number> {
  return new Promise((resolve) => {
    https.request(url, { method: 'HEAD' }, (res) => {
      resolve(parseInt(res.headers['content-length'] || '0'));
    }).on('error', () => resolve(0)).end();
  });
}

fetch('https://alfredncy.itch.io/serenitrove').then(r => r.text()).then(async html => {
  const $ = cheerio.load(html);
  const imgs = $("img").toArray();
  for (const el of imgs) {
    const src = $(el).attr("src");
    if (src && src.startsWith("http")) {
      const size = await getImageSize(src);
      console.log(src, size, $(el).attr("class"));
    }
  }
});

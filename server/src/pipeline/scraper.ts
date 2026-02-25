import axios from 'axios';
import { load, type CheerioAPI } from 'cheerio';
import type { Source } from '../sources/types';
import { getRenderedHtml } from './jsRenderer';

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
};

const MAX_PER_SOURCE = 20;

export interface IndexEntry {
  url: string;
  publishedAt?: Date;
  title?: string;
  text?: string;
}

// ---------------------------------------------------------------------------
// RSS mode — used when source.rssUrl is set
// Regex-based extraction is more reliable than cheerio for <link> in RSS 2.0
// because cheerio treats <link> as a void element in HTML mode.
// ---------------------------------------------------------------------------

async function scrapeRss(source: Source): Promise<IndexEntry[]> {
  let xml: string;
  try {
    const resp = await axios.get<string>(source.rssUrl!, {
      headers: { ...REQUEST_HEADERS, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      timeout: 15_000,
    });
    xml = resp.data;
  } catch (err) {
    console.error(`[${source.name}] Failed to fetch RSS: ${(err as Error).message}`);
    return [];
  }

  const seen = new Map<string, IndexEntry>();

  // Detect format: RSS 2.0 uses <item>, Atom uses <entry>
  const rssBlocks = xml.split(/<item[\s>]/i).slice(1);
  const atomBlocks = xml.split(/<entry[\s>]/i).slice(1);
  const isAtom = rssBlocks.length === 0 && atomBlocks.length > 0;
  const itemBlocks = isAtom ? atomBlocks : rssBlocks;

  console.log(`[${source.name}] RSS: ${xml.length} bytes | format: ${isAtom ? 'Atom' : 'RSS 2.0'} | ${itemBlocks.length} entries`);

  for (const block of itemBlocks) {
    let url = '';

    if (isAtom) {
      // Atom: <link href="..." rel="alternate"/> or just <link href="..."/>
      const linkMatch = block.match(/<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*\/?>/i);
      url = linkMatch?.[1]?.trim() ?? '';
    } else {
      // RSS 2.0: <link>URL</link> — handle optional CDATA wrapper
      const linkMatch = block.match(
        /<link>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?<\/link>/i,
      );
      url = linkMatch?.[1]?.trim() ?? '';

      // Fallback: <guid> that looks like a URL
      if (!url) {
        const guidMatch = block.match(/<guid[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+)/i);
        url = guidMatch?.[1]?.trim() ?? '';
      }
    }

    if (!url) continue;

    try {
      const u = new URL(url);
      u.search = '';
      u.hash = '';
      url = u.toString();
    } catch {
      continue;
    }

    if (source.urlPattern && !source.urlPattern.test(url)) continue;

    // Extract publish date from feed entry
    let publishedAt: Date | undefined;
    if (isAtom) {
      // Atom: <published>2024-01-01T12:00:00Z</published>
      const pubMatch = block.match(/<published>([^<]+)<\/published>/i);
      if (pubMatch) {
        const d = new Date(pubMatch[1].trim());
        if (!isNaN(d.getTime())) publishedAt = d;
      }
      // Fallback to <updated>
      if (!publishedAt) {
        const updMatch = block.match(/<updated>([^<]+)<\/updated>/i);
        if (updMatch) {
          const d = new Date(updMatch[1].trim());
          if (!isNaN(d.getTime())) publishedAt = d;
        }
      }
    } else {
      // RSS 2.0: <pubDate>Mon, 01 Jan 2024 12:00:00 +0000</pubDate>
      const pubMatch = block.match(/<pubDate>([^<]+)<\/pubDate>/i);
      if (pubMatch) {
        const d = new Date(pubMatch[1].trim());
        if (!isNaN(d.getTime())) publishedAt = d;
      }
    }

    // Extract title and description/summary as content hints
    const entryTitle = extractRssText(block, /<title[^>]*>/i, /<\/title>/i) ?? undefined;
    let entryText: string | undefined;
    if (isAtom) {
      entryText = (
        extractRssText(block, /<content[^>]*>/i, /<\/content>/i) ??
        extractRssText(block, /<summary[^>]*>/i, /<\/summary>/i)
      ) ?? undefined;
    } else {
      entryText = (
        extractRssText(block, /<content:encoded>/i, /<\/content:encoded>/i) ??
        extractRssText(block, /<description>/i, /<\/description>/i)
      ) ?? undefined;
    }

    seen.set(url, {
      url,
      publishedAt,
      title: entryTitle || undefined,
      text: entryText || undefined,
    });
    if (seen.size >= MAX_PER_SOURCE) break;
  }

  const entries = Array.from(seen.values());
  console.log(`[${source.name}] ${entries.length} candidate article(s) found in RSS`);
  return entries;
}

/**
 * Extract text content from a feed element, stripping CDATA wrappers and HTML tags.
 * Returns null if the tag is not found.
 */
function extractRssText(block: string, openTag: RegExp, closeTag: RegExp): string | null {
  const openMatch = openTag.exec(block);
  if (!openMatch) return null;
  const start = openMatch.index + openMatch[0].length;
  const closeMatch = closeTag.exec(block.slice(start));
  if (!closeMatch) return null;
  let raw = block.slice(start, start + closeMatch.index);
  // Strip CDATA wrapper: <![CDATA[ ... ]]>
  raw = raw.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
  // Strip HTML tags via cheerio (handles entities too)
  return (load(raw) as CheerioAPI)('*').length > 0 ? load(raw).text().trim() : raw.trim();
}

// ---------------------------------------------------------------------------
// HTML scrape mode — used when source.rssUrl is absent
// ---------------------------------------------------------------------------

async function scrapeHtml(source: Source): Promise<IndexEntry[]> {
  let html: string;
  try {
    if (source.requiresJs) {
      html = await getRenderedHtml(source.indexUrl);
    } else {
      const resp = await axios.get<string>(source.indexUrl, {
        headers: REQUEST_HEADERS,
        timeout: 15_000,
      });
      html = resp.data;
    }
  } catch (err) {
    console.error(`[${source.name}] Failed to fetch index: ${(err as Error).message}`);
    return [];
  }

  const $ = load(html);

  const totalLinks = $('a').length;
  const selectorMatches = $(source.linkSelector).length;
  console.log(`[${source.name}] HTML: ${html.length} bytes | <a>: ${totalLinks} | selector hits: ${selectorMatches}`);

  if (totalLinks < 5) {
    console.warn(`[${source.name}] Page appears JS-rendered (consider adding rssUrl):`);
    console.warn(html.slice(0, 300));
  }

  const seen = new Set<string>();

  $(source.linkSelector).each((_, el) => {
    let href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    if (href.startsWith('/')) {
      href = source.baseUrl + href;
    } else if (!href.startsWith('http')) {
      href = `${source.baseUrl}/${href}`;
    }

    try {
      const u = new URL(href);
      u.search = '';
      u.hash = '';
      href = u.toString();
    } catch {
      return;
    }

    if (source.urlPattern && !source.urlPattern.test(href)) return;

    seen.add(href);
  });

  const entries = Array.from(seen).slice(0, MAX_PER_SOURCE).map((url) => ({ url }));
  console.log(`[${source.name}] ${entries.length} candidate article(s) found on index`);
  return entries;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function scrapeIndex(source: Source): Promise<IndexEntry[]> {
  return source.rssUrl ? scrapeRss(source) : scrapeHtml(source);
}

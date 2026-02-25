import axios from 'axios';
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Source } from '../sources/types';
import { getRenderedHtml } from './jsRenderer';

const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

const MAX_TEXT_CHARS = 15_000;

export interface ArticleContent {
  url: string;
  sourceName: string;
  title: string | null;
  publishedAt: Date;
  text: string;
}

function extractTitle($: CheerioAPI): string | null {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle?.trim()) return ogTitle.trim();

  const h1 = $('h1').first().text().trim();
  if (h1) return h1;

  return null;
}

function extractDate($: CheerioAPI): Date | null {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const json = JSON.parse($(el).html() ?? '{}') as unknown;
      const candidates = Array.isArray(json) ? json : [json];
      for (const obj of candidates as Record<string, unknown>[]) {
        const raw = (obj.datePublished ?? obj.dateModified) as string | undefined;
        if (raw) {
          const d = new Date(raw);
          if (!isNaN(d.getTime())) return d;
        }
      }
    } catch {
      // malformed JSON-LD — continue
    }
  }

  const timeAttr = $('time[datetime]').first().attr('datetime');
  if (timeAttr) {
    const d = new Date(timeAttr);
    if (!isNaN(d.getTime())) return d;
  }

  const metaContent =
    $('meta[property="article:published_time"]').attr('content') ??
    $('meta[name="pubdate"]').attr('content') ??
    $('meta[name="date"]').attr('content') ??
    $('meta[itemprop="datePublished"]').attr('content');
  if (metaContent) {
    const d = new Date(metaContent);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function isWithin24Hours(date: Date): boolean {
  const diff = Date.now() - date.getTime();
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
}

function extractText($: CheerioAPI, bodySelector: string): string {
  let container = $(bodySelector).first();

  if (!container.length || container.text().trim().length < 150) {
    container = $('article').first();
  }

  if (!container.length || container.text().trim().length < 150) {
    return $('main p, article p, body p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 30)
      .join('\n\n');
  }

  container
    .find('nav, aside, footer, script, style, [class*="related"], [class*="sidebar"], [class*="promo"]')
    .remove();

  return container
    .find('p')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 20)
    .join('\n\n');
}

export async function fetchArticle(
  url: string,
  source: Source,
  hintDate?: Date,
  hintText?: string,
): Promise<ArticleContent | null> {
  let html: string;
  try {
    if (source.requiresJs) {
      html = await getRenderedHtml(url);
    } else {
      const resp = await axios.get<string>(url, {
        headers: REQUEST_HEADERS,
        timeout: 15_000,
      });
      html = resp.data;
    }
  } catch (err) {
    console.warn(`  [skip] ${url}\n         fetch error: ${(err as Error).message}`);
    return null;
  }

  const $ = load(html);

  const publishedAt = extractDate($) ?? hintDate ?? null;
  if (!publishedAt) {
    console.warn(`  [skip] ${url}\n         could not determine publish date`);
    return null;
  }
  if (!isWithin24Hours(publishedAt)) {
    console.log(`  [skip] ${url}\n         published ${publishedAt.toISOString()} — outside 24 h window`);
    return null;
  }

  const pageText = extractText($, source.bodySelector);
  const text = pageText.length >= 100 ? pageText : (hintText ?? '');
  if (text.length < 30) {
    console.warn(`  [skip] ${url}\n         extracted body too short (${pageText.length} chars, no hint)`);
    return null;
  }

  const pageTitle = extractTitle($);
  return {
    url,
    sourceName: source.name,
    title: pageTitle,
    publishedAt,
    text: text.slice(0, MAX_TEXT_CHARS),
  };
}

import type { ArticleContent } from './articleScraper';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'after',
  'before', 'that', 'this', 'it', 'its', 'over', 'into', 'about', 'up',
]);

const JACCARD_THRESHOLD = 0.35;

function normalizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((w) => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export interface ArticleSource {
  name: string;
  url: string;
}

/** A deduplicated article that may have been covered by multiple sources. */
export interface DedupedArticle {
  sources: ArticleSource[];
  title: string | null;
  publishedAt: Date;
  text: string; // from first source found — used for summarisation
}

export interface DeduplicationResult {
  unique: DedupedArticle[];
  removed: number;
}

export function deduplicateArticles(articles: ArticleContent[]): DeduplicationResult {
  // Pass 1: URL dedup
  const urlSeen = new Set<string>();
  const afterUrlDedup: ArticleContent[] = [];
  for (const article of articles) {
    if (!urlSeen.has(article.url)) {
      urlSeen.add(article.url);
      afterUrlDedup.push(article);
    }
  }

  // Pass 2: Jaccard title similarity — merge sources rather than discarding
  const unique: DedupedArticle[] = [];
  const titleSets: Set<string>[] = [];
  let removed = 0;

  for (const article of afterUrlDedup) {
    const titleToCheck = article.title ?? article.url;
    const words = normalizeTitle(titleToCheck);

    let dupIndex = -1;
    for (let i = 0; i < titleSets.length; i++) {
      if (jaccardSimilarity(words, titleSets[i]) >= JACCARD_THRESHOLD) {
        dupIndex = i;
        break;
      }
    }

    if (dupIndex === -1) {
      // New unique story
      unique.push({
        sources: [{ name: article.sourceName, url: article.url }],
        title: article.title,
        publishedAt: article.publishedAt,
        text: article.text,
      });
      titleSets.push(words);
    } else {
      // Same story — add source only if this source name isn't already listed
      const alreadyHasSource = unique[dupIndex].sources.some((s) => s.name === article.sourceName);
      if (!alreadyHasSource) {
        unique[dupIndex].sources.push({ name: article.sourceName, url: article.url });
      }
      removed++;
    }
  }

  return { unique, removed };
}

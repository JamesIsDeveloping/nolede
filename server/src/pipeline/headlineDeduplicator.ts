import OpenAI from 'openai';
import { env } from '../config/env';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface SummarisedArticle {
  sources: { name: string; url: string }[];
  title: string | null;
  publishedAt: Date;
  headline: string;
  summary: string;
  detail: string;
  category: string;
  importance: number;
  aiMerged: boolean;
}

/**
 * Sends all summarised headlines to GPT in a single call.
 * Returns groups of indices (each inner array = same story).
 * Articles in the same group are merged: sources combined, highest-importance
 * article's text kept.
 */
export async function aiDeduplicateHeadlines<T extends SummarisedArticle>(articles: T[]): Promise<T[]> {
  if (articles.length < 2) return articles;

  const headlineList = articles
    .map((a, i) => `${i}: "${a.headline}"`)
    .join('\n');

  console.log(`[headlineDedup] sending ${articles.length} headlines to GPT:`);
  articles.forEach((a, i) => console.log(`  ${i}: "${a.headline}"`));

  const prompt = `You are a news deduplication assistant. Group the following numbered news headlines by story.

Be VERY aggressive about grouping — err strongly on the side of merging. If two headlines could plausibly describe the same real-world event, group them together. It is much better to over-group than to miss a duplicate.

Group together headlines that:
- Describe the same incident (same location + same type of event counts even if wording differs)
- Are different angles on the same story
- Cover the same person/organisation doing the same thing
- Report the same announcement, result, or outcome

Return ONLY a JSON array of arrays. Each inner array contains the 0-based indices of headlines about the same story. Every index from 0 to ${articles.length - 1} must appear exactly once.

Headlines:
${headlineList}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You are a deduplication engine. Return ONLY {"groups":[[...],[...],...]}, a JSON object with a single "groups" key containing an array of arrays of integers.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    console.log(`[headlineDedup] raw GPT response: ${raw}`);

    const parsed = JSON.parse(raw) as { groups?: unknown };
    const groups = parsed.groups;

    if (!Array.isArray(groups)) {
      console.warn('[headlineDedup] unexpected response shape — "groups" key missing or not an array, skipping AI dedup');
      return articles;
    }

    console.log(`[headlineDedup] parsed ${groups.length} group(s):`, JSON.stringify(groups));

    // Validate: collect all indices GPT returned
    const seen = new Set<number>();
    const validGroups: number[][] = [];
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      const validGroup: number[] = [];
      for (const idx of group) {
        if (typeof idx !== 'number' || idx < 0 || idx >= articles.length) {
          console.warn(`[headlineDedup] invalid index in group: ${idx}`);
          continue;
        }
        if (seen.has(idx)) {
          console.warn(`[headlineDedup] duplicate index ${idx} in groups, skipping`);
          continue;
        }
        seen.add(idx);
        validGroup.push(idx);
      }
      if (validGroup.length > 0) validGroups.push(validGroup);
    }

    // Any indices GPT forgot → add as singletons so they still get included
    for (let i = 0; i < articles.length; i++) {
      if (!seen.has(i)) {
        console.warn(`[headlineDedup] index ${i} ("${articles[i].headline}") missing from GPT groups — adding as singleton`);
        validGroups.push([i]);
      }
    }

    const merged: T[] = [];
    let mergedCount = 0;

    for (const validIndices of validGroups) {
      if (validIndices.length === 0) continue;

      if (validIndices.length === 1) {
        merged.push({ ...articles[validIndices[0]], aiMerged: false });
        continue;
      }

      // Pick winner: highest importance; tie-break: lowest index (earlier source = preferred)
      const sorted = [...validIndices].sort((a, b) => articles[b].importance - articles[a].importance || a - b);
      const winner = { ...articles[sorted[0]], aiMerged: true };

      // Merge sources from all group members (deduplicate by URL and by source name)
      const urlSeen = new Set(winner.sources.map((s) => s.url));
      const nameSeen = new Set(winner.sources.map((s) => s.name));
      for (let k = 1; k < sorted.length; k++) {
        for (const src of articles[sorted[k]].sources) {
          if (!urlSeen.has(src.url) && !nameSeen.has(src.name)) {
            urlSeen.add(src.url);
            nameSeen.add(src.name);
            winner.sources = [...winner.sources, src];
          }
        }
        // Use earliest publishedAt
        if (articles[sorted[k]].publishedAt < winner.publishedAt) {
          winner.publishedAt = articles[sorted[k]].publishedAt;
        }
      }

      merged.push(winner);
      mergedCount += validIndices.length - 1;
      console.log(`  [aiDedup] merged ${validIndices.length} articles → "${winner.headline}" (sources: ${winner.sources.map(s => s.name).join(', ')})`);
    }

    if (mergedCount > 0) {
      console.log(`[headlineDedup] AI merged ${mergedCount} duplicate(s) — ${merged.length} unique stories remain`);
    }

    return merged;
  } catch (err) {
    console.error(`[headlineDedup] error: ${(err as Error).message}, skipping AI dedup`);
    return articles;
  }
}

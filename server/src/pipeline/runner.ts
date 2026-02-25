import type { Types } from 'mongoose';
import { sources } from '../sources';
import { scrapeIndex } from './scraper';
import { fetchArticle } from './articleScraper';
import { closeBrowser } from './jsRenderer';
import { deduplicateArticles } from './deduplicator';
import { summarize } from './summarizer';
import { aiDeduplicateHeadlines } from './headlineDeduplicator';
import { scoreImportance } from './importanceScorer';
import { Run } from '../models/Run';
import { Article } from '../models/Article';

const FETCH_DELAY_MS = 600;
const SUMMARIZE_BATCH = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runPipeline(runId: Types.ObjectId, selectedSources: string[]): Promise<void> {
  const activeSources = selectedSources.length > 0
    ? sources.filter((s) => selectedSources.includes(s.name))
    : sources;

  try {
    console.log(`[runner:${runId}] Scraping ${activeSources.length} source(s): ${activeSources.map(s => s.name).join(', ')}`);
    const urlLists = await Promise.all(activeSources.map((s) => scrapeIndex(s)));

    const allArticles = [];
    let fetched = 0;

    for (let i = 0; i < activeSources.length; i++) {
      const source = activeSources[i];
      const entries = urlLists[i];

      for (const entry of entries) {
        const hintParts = [entry.title, entry.text].filter((s): s is string => !!s);
        const hintText = hintParts.length > 0 ? hintParts.join('. ') : undefined;
        const article = await fetchArticle(entry.url, source, entry.publishedAt, hintText);
        if (article) {
          allArticles.push(article);
          fetched++;
        }
        await sleep(FETCH_DELAY_MS);
      }
    }

    console.log(`[runner:${runId}] Fetched ${fetched} articles`);

    const { unique, removed } = deduplicateArticles(allArticles);
    console.log(`[runner:${runId}] Deduplicated: ${removed} merged into existing stories, ${unique.length} unique stories`);

    const toInsert: {
      runId: Types.ObjectId;
      sources: { name: string; url: string }[];
      title: string | null;
      publishedAt: Date;
      headline: string;
      summary: string;
      detail: string;
      category: string;
      importance: number;
      aiMerged: boolean;
    }[] = [];
    let discarded = 0;

    for (let i = 0; i < unique.length; i += SUMMARIZE_BATCH) {
      const batch = unique.slice(i, i + SUMMARIZE_BATCH);
      const summaries = await Promise.all(batch.map((a) => summarize(a.text)));

      for (let j = 0; j < batch.length; j++) {
        const result = summaries[j];
        const article = batch[j];
        const label = article.sources.map(s => s.name).join('+');

        if (result.worthIt) {
          toInsert.push({
            runId,
            sources: article.sources,
            title: article.title,
            publishedAt: article.publishedAt,
            headline: result.headline,
            summary: result.summary,
            detail: result.detail,
            category: result.category,
            importance: 50, // placeholder — overwritten by batch importance scorer below
            aiMerged: false,
          });
          console.log(`  [keep] (${label}) ${article.sources[0].url}`);
        } else {
          discarded++;
          console.log(`  [discard] (${label}) ${article.sources[0].url}`);
        }
      }
    }

    // Pass 3: AI headline deduplication — catches same-story articles that
    // survived Jaccard dedup (different wording, same event)
    console.log(`[runner:${runId}] Starting AI headline dedup on ${toInsert.length} article(s)`);
    const finalArticles = toInsert.length >= 2
      ? await aiDeduplicateHeadlines(toInsert)
      : toInsert;
    console.log(`[runner:${runId}] AI dedup complete: ${toInsert.length} → ${finalArticles.length} article(s)`);

    // Pass 4: Batch relative importance scoring (0–100) based on all headlines together
    if (finalArticles.length > 0) {
      console.log(`[runner:${runId}] Scoring importance for ${finalArticles.length} article(s)`);
      const scores = await scoreImportance(finalArticles.map((a) => ({ headline: a.headline, summary: a.summary })));
      finalArticles.forEach((a, i) => { a.importance = scores[i]; });
    }

    if (finalArticles.length > 0) {
      await Article.insertMany(finalArticles);
    }

    await Run.findByIdAndUpdate(runId, {
      completedAt: new Date(),
      status: 'completed',
      stats: { fetched, deduplicated: removed, kept: finalArticles.length, discarded },
    });

    // Keep the 7 most recent completed runs; prune anything older
    const allCompleted = await Run.find({ status: 'completed' })
      .sort({ completedAt: -1 })
      .select('_id')
      .lean();
    const toDelete = allCompleted.slice(7);
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((r) => r._id);
      await Article.deleteMany({ runId: { $in: deleteIds } });
      await Run.deleteMany({ _id: { $in: deleteIds } });
      console.log(`[runner:${runId}] Pruned ${toDelete.length} old run(s), keeping 7`);
    }

    console.log(`[runner:${runId}] Done — ${finalArticles.length} articles saved`);
  } catch (err) {
    console.error(`[runner:${runId}] Fatal error:`, err);
    await Run.findByIdAndUpdate(runId, {
      completedAt: new Date(),
      status: 'failed',
      error: (err as Error).message,
    });
  } finally {
    await closeBrowser();
  }
}

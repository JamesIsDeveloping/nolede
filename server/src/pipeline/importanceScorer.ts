import OpenAI from "openai";
import { env } from "../config/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface ArticleForScoring {
  headline: string;
  summary: string;
}

/**
 * Scores a batch of articles 0–100 relative to each other based on
 * how much the average person should care about each story today.
 * Returns scores in input order. Falls back to 50 on any error or
 * for any article GPT omits.
 */
export async function scoreImportance(
  articles: ArticleForScoring[],
): Promise<number[]> {
  if (articles.length === 0) return [];
  if (articles.length === 1) return [50];

  const list = articles
    .map((a, i) => `${i}: ${a.headline} — ${a.summary}`)
    .join("\n");

  console.log(`[importanceScorer] scoring ${articles.length} articles`);

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: Math.max(800, articles.length * 30),
      messages: [
        {
          role: "system",
          content:
            'You are a news importance scorer. Return ONLY valid JSON in this exact format: {"scores":[{"index":0,"score":75},...]} — one entry per input article, covering every index.',
        },
        {
          role: "user",
          content: `Rate each news headline 0-100 relative to all others in this batch.
100 = most significant story the average person should know about today.
0 = least significant.
Distribute scores meaningfully across the full range — do NOT cluster them at a single value.
Score higher: major policy decisions, wars/conflicts, disasters, elections, economic crises, significant scientific breakthroughs, geopolitical events.
Score lower: celebrity gossip, minor sports results, niche/local interest, lifestyle or human-interest pieces.
Every index from 0 to ${articles.length - 1} must appear exactly once.

Headlines:
${list}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const finishReason = completion.choices[0]?.finish_reason;
    if (finishReason === "length") {
      console.warn(
        "[importanceScorer] response truncated (finish_reason=length) — some scores may default to 50",
      );
    }
    console.log(
      `[importanceScorer] raw response: ${raw.slice(0, 300)}${raw.length > 300 ? "…" : ""}`,
    );

    const parsed = JSON.parse(raw) as { scores?: unknown };
    const arr = Array.isArray(parsed.scores) ? parsed.scores : [];

    const scores = new Array<number>(articles.length).fill(50);

    if (arr.length > 0 && typeof arr[0] === "number") {
      // GPT returned a positional array: [75, 42, 31, ...]
      (arr as number[]).forEach((score, i) => {
        if (i < articles.length) {
          scores[i] = Math.min(100, Math.max(0, Math.round(score)));
        }
      });
    } else {
      // Expected format: [{index: 0, score: 75}, ...]
      for (const item of arr) {
        if (typeof item !== "object" || item === null) continue;
        const obj = item as Record<string, unknown>;
        const idx = Number(obj.index);
        const score = Number(obj.score);
        if (!isNaN(idx) && idx >= 0 && idx < articles.length && !isNaN(score)) {
          scores[idx] = Math.min(100, Math.max(0, Math.round(score)));
        }
      }
    }

    console.log(`[importanceScorer] done — scores: ${scores.join(", ")}`);
    return scores;
  } catch (err) {
    console.error(
      `[importanceScorer] error: ${(err as Error).message} — defaulting all to 50`,
    );
    return new Array<number>(articles.length).fill(50);
  }
}

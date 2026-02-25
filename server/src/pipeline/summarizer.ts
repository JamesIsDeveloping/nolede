import OpenAI from 'openai';
import { env } from '../config/env';

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const CATEGORIES = [
  'politics', 'sports', 'business', 'crime', 'world',
  'environment', 'health', 'entertainment', 'local',
] as const;

export type Category = typeof CATEGORIES[number];

export type SummaryResult =
  | { worthIt: true; headline: string; summary: string; detail: string; category: Category }
  | { worthIt: false };

const SYSTEM_PROMPT = `\
You are a news summariser for a New Zealand news digest app. Analyse the article text and return ONLY a JSON object — no markdown, no explanation, no extra keys.

KEEP any article that reports something that actually happened — hard news, politics, crime, sports results, business, entertainment, local community stories, quirky/offbeat stories, weather events, or anything a New Zealander would genuinely want to know about today.

DISCARD only if the text is clearly not a news article: error pages, login/paywall screens, navigation menus, product listings, recipe pages, crosswords/quizzes, or live-blog placeholder pages with no real content yet.

If KEEP:
{"worthIt":true,"headline":"<6-10 word news headline>","summary":"<15-30 word key-facts sentence>","detail":"<60-100 word paragraph>","category":"<one of: politics|sports|business|crime|world|environment|health|entertainment|local>"}

If DISCARD: {"worthIt":false}

Requirements when worthIt is true:
- headline: 6-10 words, title case, no full stop, written as a newspaper headline
- summary: 15-30 words, states WHO did WHAT and WHERE or WHY, simple past tense, no opinion
- detail: 60-100 words, expands on the summary with supporting facts and context, simple past tense, no opinion
- category: exactly one label from the list above
- Proper nouns and numbers preserved exactly as in the article`.trim();

export async function summarize(text: string): Promise<SummaryResult> {
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Article text:\n\n${text}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const rawCategory = String(parsed.category ?? '').toLowerCase();
    const category: Category = (CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as Category)
      : 'local';

    if (
      parsed.worthIt === true &&
      typeof parsed.headline === 'string' && parsed.headline.length > 0 &&
      typeof parsed.summary === 'string' && parsed.summary.length > 0 &&
      typeof parsed.detail === 'string' && parsed.detail.length > 0
    ) {
      return {
        worthIt: true,
        headline: parsed.headline.trim(),
        summary: parsed.summary.trim(),
        detail: parsed.detail.trim(),
        category,
      };
    }

    return { worthIt: false };
  } catch (err) {
    console.error(`    [summarizer] error: ${(err as Error).message}`);
    return { worthIt: false };
  }
}

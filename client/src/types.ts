export interface RunStats {
  fetched: number;
  deduplicated: number;
  kept: number;
  discarded: number;
}

export interface Run {
  _id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  stats: RunStats;
}

export interface ArticleSource {
  name: string;
  url: string;
}

export const CATEGORIES = [
  'politics', 'sports', 'business', 'crime', 'world',
  'environment', 'health', 'entertainment', 'local',
] as const;

export type Category = typeof CATEGORIES[number];

export interface Article {
  _id: string;
  runId: string;
  sources: ArticleSource[];
  title: string | null;
  publishedAt: string;
  headline: string | null;
  summary: string;
  detail: string | null;
  category: Category;
  importance: number;
  aiMerged: boolean;
  createdAt: string;
}

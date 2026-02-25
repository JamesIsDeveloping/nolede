import type { Run, Article } from '../types';

const BASE = '/api';

async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function fetchRuns(limit = 20): Promise<Run[]> {
  return json<Run[]>(`/runs?limit=${limit}`);
}

export function fetchArticles(params: {
  runId?: string;
  sources?: string[];
  category?: string | null;
  offset?: number;
  limit?: number;
  sort?: string;
} = {}): Promise<Article[]> {
  const q = new URLSearchParams();
  if (params.runId) q.set('runId', params.runId);
  if (params.sources?.length) q.set('sources', params.sources.join(','));
  if (params.category) q.set('category', params.category);
  if (params.offset != null) q.set('offset', String(params.offset));
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.sort) q.set('sort', params.sort);
  return json<Article[]>(`/articles?${q}`);
}

export function triggerRun(sources: string[]): Promise<{ runId: string }> {
  return json<{ runId: string }>('/runs/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources }),
  });
}

export function rescoreRun(runId: string): Promise<{ rescored: number }> {
  return json<{ rescored: number }>(`/runs/${runId}/rescore`, { method: 'POST' });
}

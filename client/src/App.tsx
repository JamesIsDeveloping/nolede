import { useState, useEffect, useRef } from "react";
import type { Run, Article, Category } from "./types";
import { fetchRuns, fetchArticles, triggerRun, rescoreRun } from "./api/client";
import { CategoryFilter } from "./components/CategoryFilter";
import { DayPicker } from "./components/DayPicker";
import { SourceDropdown, ALL_SOURCES } from "./components/SourceDropdown";
import { ArticleCard } from "./components/ArticleCard";

const PREFS_KEY = "nolede-prefs";

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

const PAGE_SIZE = 20;
const POLL_MS = 5_000;

function lastUpdatedLabel(run: Run | null): string {
  if (!run?.completedAt) return "";
  const date = new Date(run.completedAt);
  const now = new Date();
  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (date.toDateString() === now.toDateString())
    return `Updated today at ${timeStr}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString())
    return `Updated yesterday at ${timeStr}`;
  const dateStr = date.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `Updated ${dateStr} at ${timeStr}`;
}

export default function App() {
  const [latestRun, setLatestRun] = useState<Run | null>(null);
  const [completedRuns, setCompletedRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [enabledSources, setEnabledSources] = useState<string[]>(() => {
    const prefs = loadPrefs();
    const saved = prefs.enabledSources;
    return Array.isArray(saved) && saved.length > 0 ? saved : [...ALL_SOURCES];
  });
  const [sort, setSort] = useState<string>(() => {
    const prefs = loadPrefs();
    return typeof prefs.sort === "string" ? prefs.sort : "importance_desc";
  });
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Persist sort + source prefs to localStorage
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sort, enabledSources }));
  }, [sort, enabledSources]);

  // Refs so the IntersectionObserver callback always has fresh values
  const stateRef = useRef({
    hasMore, loadingMore, loading, articles, category, sort, selectedRunId, enabledSources,
  });
  stateRef.current = {
    hasMore, loadingMore, loading, articles, category, sort, selectedRunId, enabledSources,
  };

  // ── Load articles (reset = first page, append = next page) ──────────────
  async function loadArticles(opts: { reset: boolean }) {
    const {
      category: cat,
      sort: s,
      articles: prev,
      selectedRunId: runId,
      enabledSources: sources,
    } = stateRef.current;
    const offset = opts.reset ? 0 : prev.length;

    if (opts.reset) {
      setLoading(true);
      setArticles([]);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await fetchArticles({
        runId: runId ?? undefined,
        sources: sources.length < ALL_SOURCES.length ? sources : undefined,
        category: cat,
        offset,
        limit: PAGE_SIZE,
        sort: s,
      });
      setArticles((existing) => (opts.reset ? data : [...existing, ...data]));
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (opts.reset) setLoading(false);
      else setLoadingMore(false);
    }
  }

  // Stable ref so IntersectionObserver callback never goes stale
  const loadMoreRef = useRef<() => void>();
  loadMoreRef.current = () => {
    const { hasMore: hm, loadingMore: lm, loading: l } = stateRef.current;
    if (!hm || lm || l) return;
    void loadArticles({ reset: false });
  };

  // ── IntersectionObserver (set up once) ──────────────────────────────────
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current?.();
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    void loadArticles({ reset: true });
    void fetchRuns(7).then((runs) => {
      setLatestRun(runs[0] ?? null);
      setCompletedRuns(runs.filter((r) => r.status === "completed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reload when filters change ───────────────────────────────────────────
  const filterKey = (category ?? "") + "|" + sort + "|" + (selectedRunId ?? "") + "|" + enabledSources.slice().sort().join(",");
  const prevFilterKey = useRef<string | null>(null);
  useEffect(() => {
    if (prevFilterKey.current === null) {
      prevFilterKey.current = filterKey;
      return; // skip — initial load handled above
    }
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      void loadArticles({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // ── Poll while a run is in progress ─────────────────────────────────────
  useEffect(() => {
    if (latestRun?.status !== "running") return;
    const id = setInterval(async () => {
      const runs = await fetchRuns(7);
      const run = runs[0] ?? null;
      setLatestRun(run);
      setCompletedRuns(runs.filter((r) => r.status === "completed"));
      if (run?.status === "completed") {
        void loadArticles({ reset: true });
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRun?.status]);

  const [adminMode, setAdminMode] = useState(false);
  const updatedLabel = lastUpdatedLabel(latestRun);
  const isRunning = latestRun?.status === "running";

  async function handleTriggerRun() {
    if (isRunning) return;
    try {
      await triggerRun([]);
      const runs = await fetchRuns(7);
      setLatestRun(runs[0] ?? null);
      setCompletedRuns(runs.filter((r) => r.status === "completed"));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRescore() {
    const runId = selectedRunId ?? latestRun?._id;
    if (!runId || rescoring) return;
    setRescoring(true);
    try {
      await rescoreRun(runId);
      void loadArticles({ reset: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRescoring(false);
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title" onClick={() => setAdminMode((m) => !m)}>
            Nolede
          </h1>
          <p className="app__subtitle">
            {isRunning ? "Updating…" : updatedLabel || "\u00a0"}
          </p>
        </div>
        {adminMode && (
          <div className="app__header-actions">
            <button
              className="app__trigger"
              onClick={() => { void handleRescore(); }}
              disabled={rescoring || isRunning}
            >
              {rescoring ? "Rescoring…" : "Rescore"}
            </button>
            <button
              className="app__trigger"
              onClick={() => { void handleTriggerRun(); }}
              disabled={isRunning}
            >
              {isRunning ? "Running…" : "Run now"}
            </button>
          </div>
        )}
      </header>

      {error && <div className="app__error">{error}</div>}

      <CategoryFilter selected={category} onChange={setCategory} />

      <div className="app__toolbar">
        <DayPicker
          runs={completedRuns}
          selectedId={selectedRunId}
          onChange={setSelectedRunId}
        />
        <SourceDropdown enabled={enabledSources} onChange={setEnabledSources} />
        <select
          className="app__sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort order"
        >
          <option value="importance_desc">Most important</option>
          <option value="time_desc">Newest first</option>
          <option value="time_asc">Oldest first</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>

      {loading && <div className="app__loading">Loading…</div>}

      {isRunning && !loading && (
        <div className="app__loading">Pipeline running…</div>
      )}

      <main className="app__articles">
        {articles.map((article) => (
          <ArticleCard key={article._id} article={article} />
        ))}
      </main>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} />

      {loadingMore && <div className="app__loading-more">Loading more…</div>}

      {!hasMore && articles.length > 0 && (
        <div className="app__end">You're all caught up</div>
      )}

      {!loading &&
        !loadingMore &&
        articles.length === 0 &&
        !isRunning && (
          <p className="app__empty">
            {latestRun
              ? "No articles match the current filters."
              : "No news yet — check back soon."}
          </p>
        )}

      <footer className="app__footer">
        <a
          href="https://james.org.nz"
          target="_blank"
          rel="noopener noreferrer"
        >
          Creator
        </a>
        <span className="app__footer-sep" aria-hidden="true">
          x
        </span>
        <span className="app__footer-text">
          Content on this website is summarised by Artificial Intelligence. AI
          makes mistakes, hallucinates and has biases. Keep this in mind when
          consuming this website.
        </span>
        <span className="app__footer-sep" aria-hidden="true">
          x
        </span>
        <a
          href="https://www.flaticon.com/free-icons/paper"
          target="_blank"
          rel="noopener noreferrer"
          title="paper icons"
        >
          Icons
        </a>
      </footer>
    </div>
  );
}

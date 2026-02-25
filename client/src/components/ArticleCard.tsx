import { useState } from "react";
import type { Article } from "../types";

interface Props {
  article: Article;
}

export function ArticleCard({ article }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showMergeInfo, setShowMergeInfo] = useState(false);

  const displayTitle = article.headline ?? article.title ?? "Untitled";
  const date = new Date(article.publishedAt);
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const multiSource = article.sources.length > 1;

  return (
    <article className="card">
      <div className="card__header">
        <div className="card__sources">
          {article.sources.map((s) => (
            <span
              key={s.url}
              className={`card__source card__source--${s.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {s.name}
            </span>
          ))}
          {article.category && (
            <span
              className={`card__category card__category--${article.category}`}
            >
              {article.category}
            </span>
          )}
        </div>
        <div className="card__meta">
          <span
            className="card__importance"
            data-label={`AI estimated importance vs. other headlines today: ${article.importance}%`}
          >
            {"▮".repeat(Math.round(article.importance / 20))}
            <span className="card__importance-empty">
              {"▮".repeat(5 - Math.round(article.importance / 20))}
            </span>
          </span>
          <span className="card__time">
            {dateStr} · {timeStr}
          </span>
        </div>
      </div>

      <h3 className="card__title">{displayTitle}</h3>

      <p className="card__summary">{article.summary}</p>

      {expanded && article.detail && (
        <p className="card__detail">{article.detail}</p>
      )}

      <div className="card__actions">
        <div className="card__actions-left">
          {article.detail && (
            <button
              className="card__read-more"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
          {multiSource && (
            <button
              className="card__read-more"
              onClick={() => setShowMergeInfo(true)}
            >
              Deduplicated
            </button>
          )}
        </div>

        <div className="card__links">
          {article.sources.map((s) => (
            <a
              key={s.url}
              className="card__read-full"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {multiSource ? s.name : "Read full article"} →
            </a>
          ))}
        </div>
      </div>

      {showMergeInfo && (
        <div className="modal-overlay" onClick={() => setShowMergeInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">About this article</h2>
            <p className="modal__body">
              This article combines coverage from {article.sources.length}{" "}
              sources that were automatically identified as reporting the same
              story.
              {article.aiMerged && " AI was used to match these headlines."}
            </p>
            <p className="modal__body">
              Automated deduplication can occasionally be wrong - sources may
              sometimes be grouped when they cover different stories but are
              incorrectly identified to be duplicates. You can read each source
              directly using the links on the card.
            </p>
            <button
              className="modal__close"
              onClick={() => setShowMergeInfo(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

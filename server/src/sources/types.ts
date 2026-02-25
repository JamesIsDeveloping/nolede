export interface Source {
  /** Display name shown in output */
  name: string;
  /** URL of the outlet's news index / front page (used when rssUrl is absent) */
  indexUrl: string;
  /** CSS selector for <a> elements on the index page */
  linkSelector: string;
  /** CSS selector for the article body container */
  bodySelector: string;
  /** Prepended to relative hrefs found on the index page */
  baseUrl: string;
  /** When set, a candidate URL must match this pattern to be kept */
  urlPattern?: RegExp;
  /** When set, fetch this RSS/Atom feed instead of scraping indexUrl */
  rssUrl?: string;
  /** When true, article pages are JS-rendered and need a headless browser */
  requiresJs?: boolean;
}

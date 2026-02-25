import type { Source } from './types';

export const nzSources: Source[] = [
  {
    name: 'NZ Herald',
    indexUrl: 'https://www.nzherald.co.nz/',
    rssUrl: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/nz/?outputType=xml&_website=nzh',
    linkSelector: 'a[data-test-ui="story-card--link--title"], a[data-storycard-tracking-element*="|title"]',
    bodySelector: 'article, .article-body-wrap, [class*="ArticleBody"], .article__body',
    baseUrl: 'https://www.nzherald.co.nz',
    urlPattern: /nzherald\.co\.nz\/(nz|business|world|politics|sport|technology|environment)\//,
  },
  {
    name: 'RNZ',
    indexUrl: 'https://www.rnz.co.nz/news',
    rssUrl: 'https://www.rnz.co.nz/rss/national.xml',
    linkSelector: 'h1 a, h2 a, h3 a, .story-card a, [class*="card"] a',
    bodySelector: '.article__body, .story__body, [class*="article-body"]',
    baseUrl: 'https://www.rnz.co.nz',
    urlPattern: /\/news\/(national|world|business|political)\//,
  },
  {
    name: 'RNZ',
    indexUrl: 'https://www.rnz.co.nz/news/world',
    rssUrl: 'https://www.rnz.co.nz/rss/world.xml',
    linkSelector: 'h1 a, h2 a, h3 a, .story-card a, [class*="card"] a',
    bodySelector: '.article__body, .story__body, [class*="article-body"]',
    baseUrl: 'https://www.rnz.co.nz',
    urlPattern: /\/news\/(national|world|business|political)\//,
  },
  {
    name: 'RNZ',
    indexUrl: 'https://www.rnz.co.nz/news/political',
    rssUrl: 'https://www.rnz.co.nz/rss/political.xml',
    linkSelector: 'h1 a, h2 a, h3 a, .story-card a, [class*="card"] a',
    bodySelector: '.article__body, .story__body, [class*="article-body"]',
    baseUrl: 'https://www.rnz.co.nz',
    urlPattern: /\/news\/(national|world|business|political)\//,
  },
  {
    name: 'Stuff',
    indexUrl: 'https://www.stuff.co.nz/',       // unused — rssUrl takes priority
    rssUrl: 'https://www.stuff.co.nz/rss',      // homepage is JS-rendered; use RSS instead
    linkSelector: 'a[id^="stories-for-"]',       // unused in RSS mode
    bodySelector: 'article, [data-testid*="article"], .article-content, .story__content',
    baseUrl: 'https://www.stuff.co.nz',
    // No trailing-slash requirement — RSS URLs may omit the slug
    urlPattern: /\/[a-z][a-z-]*\/\d{5,}/,
    requiresJs: true,
  },
];

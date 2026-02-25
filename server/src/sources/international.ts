import type { Source } from './types';

export const internationalSources: Source[] = [
  {
    // AP News removed their public RSS feeds — HTML scrape their homepage instead.
    // They use absolute hrefs, so use *= (contains) not ^= (starts-with).
    name: 'AP News',
    indexUrl: 'https://apnews.com',
    linkSelector: 'a[href*="/article/"]',
    bodySelector: '.RichTextStoryBody, .article-body, [class*="Body"]',
    baseUrl: 'https://apnews.com',
    urlPattern: /apnews\.com\/article\//,
  },
  {
    name: 'NPR',
    indexUrl: 'https://www.npr.org/sections/news/',
    rssUrl: 'https://feeds.npr.org/1001/rss.xml',
    linkSelector: 'h2 a, h3 a, .item-info a, .story-text a',
    bodySelector: '#storytext, .storytext, .story-text',
    baseUrl: '',
    urlPattern: /npr\.org\/\d{4}\/\d{2}\/\d{2}\//,
  },
  {
    name: 'The Guardian',
    // RSS covers world news with full pub dates — much more reliable than HTML scraping
    indexUrl: 'https://www.theguardian.com/world',
    rssUrl: 'https://www.theguardian.com/world/rss',
    linkSelector: 'h1 a, h2 a, h3 a, [class*="card"] a, [class*="headline"] a',
    bodySelector: '.article-body-commercial-selector, .content__article-body, [class*="ArticleBody"]',
    baseUrl: 'https://www.theguardian.com',
    urlPattern: /theguardian\.com\/(world|us-news|politics|environment|business|science|technology|sport)\//,
  },
  {
    name: 'CBS News',
    indexUrl: 'https://www.cbsnews.com/latest/news/',
    rssUrl: 'https://www.cbsnews.com/latest/rss/main',
    linkSelector: 'a.item__anchor, h2 a, .article__title a',
    bodySelector: '.content__body, .article-content, [class*="content__body"]',
    baseUrl: 'https://www.cbsnews.com',
    urlPattern: /cbsnews\.com\/news\//,
  },
  // Reuters removed: their site is behind Cloudflare Bot Management which blocks
  // all automated fetching (including Playwright). No public RSS available either.
];

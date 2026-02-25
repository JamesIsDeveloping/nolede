# Nolede

A daily NZ-focused news digest. Scrapes articles from NZ Herald, RNZ, Stuff, AP News, NPR, The Guardian, and CBS News — deduplicates cross-source stories, summarises them with GPT-4o-mini, and scores them by relative importance.

## Stack

- **Server** — Node.js, Express, MongoDB (Mongoose), node-cron, Playwright
- **Client** — React, Vite, TypeScript
- **AI** — OpenAI GPT-4o-mini (summarisation, deduplication, importance scoring)
- **Deploy** — Docker + docker-compose, Railway-ready

## Features

- RSS + HTML scraping across 7 sources
- Jaccard + AI headline deduplication (cross-source stories merged)
- AI-generated headline, summary, and detail per article
- Relative importance scoring (0–100) across each run's full article set
- Category filtering, source filtering, sort options, day picker
- Infinite scroll, dark theme, mobile-friendly

## Setup

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and (optionally) MONGODB_URI
npm install
```

**Dev:**

```bash
npm run dev:server   # Express on :3050
npm run dev:client   # Vite on :5173 (proxies /api to :3050)
```

**Production (Docker):**

```bash
docker compose up -d
```

Trigger a pipeline run:

```bash
curl -X POST http://localhost:3050/api/runs/trigger
```

## Environment Variables

| Variable         | Required | Default                            | Description                                                   |
| ---------------- | -------- | ---------------------------------- | ------------------------------------------------------------- |
| `OPENAI_API_KEY` | Yes      | —                                  | OpenAI API key                                                |
| `MONGODB_URI`    | No       | `mongodb://localhost:27017/nolede` | MongoDB connection string                                     |
| `PORT`           | No       | `3050`                             | Server port                                                   |
| `CRON_SCHEDULE`  | No       | `0 18 * * *`                       | node-cron schedule(s), UTC. Semicolon-separated for multiple. |

## License

Nolede Noncommercial Copyleft License — non-commercial use only, derivatives must use the same terms. See [LICENSE](LICENSE).

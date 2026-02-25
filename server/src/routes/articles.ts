import { Router } from 'express';
import { Article } from '../models/Article';
import { Run } from '../models/Run';

export const articlesRouter = Router();

// GET /api/articles?sources=RNZ,NPR&offset=0&limit=20&sort=time_desc
articlesRouter.get('/', async (req, res) => {
  try {
    let runId = req.query.runId as string | undefined;

    // Default to latest completed run
    if (!runId) {
      const latest = await Run.findOne({ status: 'completed' }).sort({ completedAt: -1 }).lean();
      if (!latest) return res.json([]);
      runId = latest._id.toString();
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const sort = (req.query.sort as string) ?? 'time_desc';

    const filter: Record<string, unknown> = { runId };

    // sources: comma-separated list of source names
    if (req.query.sources) {
      const sourceList = (req.query.sources as string)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (sourceList.length > 0) {
        filter['sources.name'] = { $in: sourceList };
      }
    }

    // category: single label e.g. "sports"
    if (req.query.category) {
      filter.category = (req.query.category as string).trim();
    }

    let sortObj: Record<string, 1 | -1>;
    if (sort === 'time_asc') {
      sortObj = { publishedAt: 1 };
    } else if (sort === 'title_asc') {
      sortObj = { headline: 1 };
    } else if (sort === 'importance_desc') {
      sortObj = { importance: -1, publishedAt: -1 };
    } else {
      sortObj = { publishedAt: -1 }; // time_desc (default)
    }

    const articles = await Article.find(filter)
      .sort(sortObj)
      .skip(offset)
      .limit(limit)
      .lean();

    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

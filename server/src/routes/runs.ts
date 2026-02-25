import { Router } from 'express';
import { Run } from '../models/Run';
import { Article } from '../models/Article';
import { runPipeline } from '../pipeline/runner';
import { scoreImportance } from '../pipeline/importanceScorer';

export const runsRouter = Router();

// GET /api/runs?limit=20
runsRouter.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const runs = await Run.find().sort({ startedAt: -1 }).limit(limit).lean();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/runs/:id
runsRouter.get('/:id', async (req, res) => {
  try {
    const run = await Run.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/runs/:id/rescore — re-run importance scoring on all articles for a run
runsRouter.post('/:id/rescore', async (req, res) => {
  try {
    const articles = await Article.find({ runId: req.params.id }).lean();
    if (articles.length === 0) return res.status(404).json({ error: 'No articles found for this run' });

    const scores = await scoreImportance(
      articles.map((a) => ({ headline: a.headline ?? '', summary: a.summary })),
    );

    await Promise.all(
      articles.map((a, i) => Article.findByIdAndUpdate(a._id, { importance: scores[i] })),
    );

    console.log(`[rescore] Run ${req.params.id}: rescored ${articles.length} articles`);
    res.json({ rescored: articles.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/runs/trigger  body: { sources: string[] }
runsRouter.post('/trigger', async (req, res) => {
  try {
    const sources: string[] = Array.isArray(req.body.sources) ? req.body.sources : [];
    const run = await Run.create({ startedAt: new Date(), status: 'running', sources });
    // Fire and forget — pipeline runs in background
    void runPipeline(run._id, sources);
    res.status(202).json({ runId: run._id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

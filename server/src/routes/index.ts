import { Router } from 'express';
import { runsRouter } from './runs';
import { articlesRouter } from './articles';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

apiRouter.use('/runs', runsRouter);
apiRouter.use('/articles', articlesRouter);

import express from 'express';
import cors from 'cors';
import path from 'path';
import { apiRouter } from './routes';
import { env } from './config/env';

export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', apiRouter);

  // Serve built client in production
  if (env.NODE_ENV === 'production') {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}

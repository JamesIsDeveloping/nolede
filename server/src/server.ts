import { connectDB } from './config/db';
import { createApp } from './app';
import { startCron } from './cron';
import { env } from './config/env';
import { Run } from './models/Run';

async function main(): Promise<void> {
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`[server] Listening on http://localhost:${env.PORT}`);
  });

  await connectDB();

  // Any run still marked 'running' at startup was interrupted — mark it failed.
  const stuck = await Run.updateMany(
    { status: 'running' },
    { $set: { status: 'failed', completedAt: new Date(), error: 'Server restarted while run was in progress' } },
  );
  if (stuck.modifiedCount > 0) {
    console.log(`[server] Marked ${stuck.modifiedCount} interrupted run(s) as failed`);
  }

  startCron();
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});

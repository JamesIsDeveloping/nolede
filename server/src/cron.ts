import cron from 'node-cron';
import { Run } from './models/Run';
import { runPipeline } from './pipeline/runner';
import { env } from './config/env';

async function triggerScheduledRun() {
  console.log('[cron] Triggering scheduled pipeline run...');
  try {
    const run = await Run.create({ startedAt: new Date(), status: 'running', sources: [] });
    void runPipeline(run._id, []);
  } catch (err) {
    console.error('[cron] Failed to start pipeline:', err);
  }
}

export function startCron(): void {
  const schedules = env.CRON_SCHEDULE.split(';').map((s) => s.trim()).filter(Boolean);
  console.log(`[cron] Registering ${schedules.length} schedule(s): ${schedules.join(' | ')}`);

  for (const schedule of schedules) {
    cron.schedule(schedule, triggerScheduledRun, { timezone: 'UTC' });
  }
}

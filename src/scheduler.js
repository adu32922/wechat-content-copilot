import cron from 'node-cron';
import { config } from './config.js';
import { runPipeline } from './pipeline.js';
import { getTopics, updateTopic } from './queue.js';

let running = false;

export async function runDueTopics() {
  if (running) return [];
  running = true;
  const results = [];
  try {
    const topics = await getTopics();
    const due = topics.filter((item) => item.status === 'pending' && new Date(item.scheduledAt).getTime() <= Date.now());
    for (const item of due) {
      try {
        await updateTopic(item.id, { status: 'running', lastError: '' });
        const result = await runPipeline(item);
        await updateTopic(item.id, { status: 'completed', resultId: result.id, completedAt: new Date().toISOString() });
        results.push({ id: item.id, ok: true, resultId: result.id });
      } catch (error) {
        await updateTopic(item.id, { status: 'failed', lastError: error.message });
        results.push({ id: item.id, ok: false, error: error.message });
      }
    }
    return results;
  } finally {
    running = false;
  }
}

export function startScheduler() {
  if (!cron.validate(config.scheduleCron)) throw new Error(`无效的 SCHEDULE_CRON：${config.scheduleCron}`);
  return cron.schedule(config.scheduleCron, () => {
    runDueTopics().catch((error) => console.error('[scheduler]', error));
  });
}

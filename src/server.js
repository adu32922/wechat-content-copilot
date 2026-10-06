import express from 'express';
import path from 'node:path';
import { config, getReadiness } from './config.js';
import { retryDraft, runPipeline } from './pipeline.js';
import { addTopic, getTopics } from './queue.js';
import { runDueTopics, startScheduler } from './scheduler.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(config.rootDir, 'public')));
app.use('/outputs', express.static(config.outputDir, { fallthrough: false }));

app.get('/api/status', (request, response) => response.json(getReadiness()));
app.get('/api/topics', async (request, response, next) => {
  try { response.json(await getTopics()); } catch (error) { next(error); }
});
app.post('/api/topics', async (request, response, next) => {
  try { response.status(201).json(await addTopic(request.body)); } catch (error) { next(error); }
});
app.post('/api/generate', async (request, response, next) => {
  try { response.json(await runPipeline(request.body)); } catch (error) { next(error); }
});
app.post('/api/results/:id/retry-draft', async (request, response, next) => {
  try { response.json(await retryDraft(request.params.id, request.body)); } catch (error) { next(error); }
});
app.post('/api/run-due', async (request, response, next) => {
  try { response.json(await runDueTopics()); } catch (error) { next(error); }
});

app.use((error, request, response, next) => {
  console.error(error);
  response.status(error.statusCode || 400).json({
    error: error.message || '请求失败',
    ...(error.result ? { result: error.result } : {}),
  });
});

startScheduler();
app.listen(config.port, () => {
  console.log(`公众号自动创作台：http://localhost:${config.port}`);
  console.log(config.demoMode ? '当前为演示模式，不会调用外部服务。' : '当前为真实连接模式。');
});

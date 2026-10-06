import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createDemoArticle } from '../src/demo.js';
import { generateCover } from '../src/openai-service.js';
import { createPipeline, PipelineError } from '../src/pipeline.js';

async function tempOutput() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'wechat-studio-test-'));
}

test('演示模式端到端生成完整文件和 1536x656 封面', async () => {
  const outputDir = await tempOutput();
  const pipeline = createPipeline({
    outputDir,
    demoMode: true,
    generateArticle: async (topic, options) => createDemoArticle(topic, options),
    generateCover,
    now: () => new Date('2026-09-29T08:00:00Z'),
  });
  const result = await pipeline.runPipeline({ topic: '普通人如何提高工作效率', saveToWechat: true });
  assert.equal(result.status, 'cover_generated');
  assert.equal(result.publish.status, 'demo_skipped');
  for (const file of ['article.json', 'article.html', 'cover.jpg', 'result.json']) {
    await fs.access(path.join(result.outputDir, file));
  }
  const metadata = await sharp(path.join(result.outputDir, 'cover.jpg')).metadata();
  assert.deepEqual([metadata.width, metadata.height, metadata.format], [1536, 656, 'jpeg']);
});

test('封面失败时保留已生成正文和阶段状态', async () => {
  const outputDir = await tempOutput();
  const pipeline = createPipeline({
    outputDir,
    demoMode: true,
    generateArticle: async (topic, options) => createDemoArticle(topic, options),
    generateCover: async () => { throw new Error('image unavailable'); },
    now: () => new Date('2026-09-29T09:00:00Z'),
  });
  let failure;
  try {
    await pipeline.runPipeline({ topic: '封面失败测试' });
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof PipelineError);
  assert.equal(failure.result.lastSuccessfulState, 'text_generated');
  assert.equal(failure.result.error.stage, 'cover_generation');
  await fs.access(path.join(failure.result.outputDir, 'article.json'));
  await assert.rejects(() => fs.access(path.join(failure.result.outputDir, 'cover.jpg')));
});

test('草稿失败后只重试上传，不重复生成正文和封面', async () => {
  const outputDir = await tempOutput();
  let articleCalls = 0;
  let coverCalls = 0;
  let draftCalls = 0;
  const pipeline = createPipeline({
    outputDir,
    demoMode: false,
    generateArticle: async (topic, options) => {
      articleCalls += 1;
      return createDemoArticle(topic, options);
    },
    generateCover: async (article, file) => {
      coverCalls += 1;
      await sharp({ create: { width: 1536, height: 656, channels: 3, background: '#145a4a' } }).jpeg().toFile(file);
    },
    addDraft: async () => {
      draftCalls += 1;
      if (draftCalls === 1) throw new Error('wechat unavailable');
      return { draftMediaId: 'draft-2', coverMediaId: 'cover-2' };
    },
    now: () => new Date('2026-09-29T10:00:00Z'),
  });

  let failure;
  try {
    await pipeline.runPipeline({ topic: '草稿重试测试', saveToWechat: true });
  } catch (error) {
    failure = error;
  }
  assert.equal(failure.result.lastSuccessfulState, 'cover_generated');
  assert.equal(failure.result.publish.status, 'failed');
  const before = await fs.readFile(path.join(failure.result.outputDir, 'article.json'), 'utf8');

  const retried = await pipeline.retryDraft(failure.result.id);
  const after = await fs.readFile(path.join(failure.result.outputDir, 'article.json'), 'utf8');
  assert.equal(retried.status, 'draft_created');
  assert.equal(retried.publish.draftMediaId, 'draft-2');
  assert.equal(articleCalls, 1);
  assert.equal(coverCalls, 1);
  assert.equal(draftCalls, 2);
  assert.equal(after, before);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { generateArticle, generateCover } from './openai-service.js';
import { articleLength, articleToHtml } from './render.js';
import { addDraft } from './wechat-service.js';
import { slugify, timestampName, writeJson } from './utils.js';

export class PipelineError extends Error {
  constructor(message, result, statusCode = 502) {
    super(message);
    this.name = 'PipelineError';
    this.result = result;
    this.statusCode = statusCode;
  }
}

function safeInput(input) {
  return {
    audience: String(input.audience || ''),
    tone: String(input.tone || ''),
    notes: String(input.notes || ''),
    author: String(input.author || '').slice(0, 16),
    saveToWechat: input.saveToWechat === true,
  };
}

function resolveResultDir(root, id) {
  if (!id || path.basename(id) !== id) throw new PipelineError('生成结果编号无效', null, 400);
  const resolved = path.resolve(root, id);
  if (path.dirname(resolved) !== path.resolve(root)) throw new PipelineError('生成结果编号无效', null, 400);
  return resolved;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function responseResult(record, article, html) {
  return {
    ...record,
    article,
    html,
    coverUrl: record.status === 'text_generated' || (record.status === 'failed' && !record.coverReady)
      ? null
      : `/outputs/${encodeURIComponent(record.id)}/cover.jpg`,
  };
}

export function createPipeline(options = {}) {
  const outputRoot = options.outputDir || config.outputDir;
  const demoMode = options.demoMode ?? config.demoMode;
  const generateArticleImpl = options.generateArticle || generateArticle;
  const generateCoverImpl = options.generateCover || generateCover;
  const addDraftImpl = options.addDraft || addDraft;
  const now = options.now || (() => new Date());

  async function persist(outputDir, record) {
    await writeJson(path.join(outputDir, 'result.json'), record);
  }

  async function runPipeline(input) {
    const topic = String(input.topic || '').trim();
    if (topic.length < 2 || topic.length > 120) throw new PipelineError('选题长度应为 2-120 个字符', null, 400);

    const startedAt = now();
    const id = `${timestampName(startedAt)}-${slugify(topic)}`;
    const outputDir = resolveResultDir(outputRoot, id);
    const storedInput = safeInput(input);
    await fs.mkdir(outputDir, { recursive: true });

    let article;
    let html;
    let stage = 'text_generation';
    let record = {
      id,
      topic,
      input: storedInput,
      status: 'failed',
      lastSuccessfulState: null,
      coverReady: false,
      publish: { status: 'not_requested' },
      outputDir,
      createdAt: startedAt.toISOString(),
      updatedAt: startedAt.toISOString(),
    };

    try {
      article = await generateArticleImpl(topic, storedInput);
      html = articleToHtml(article);
      await writeJson(path.join(outputDir, 'article.json'), article);
      await fs.writeFile(path.join(outputDir, 'article.html'), html, 'utf8');
      record = {
        ...record,
        title: article.title,
        digest: article.digest,
        articleLength: articleLength(article),
        status: 'text_generated',
        lastSuccessfulState: 'text_generated',
        updatedAt: now().toISOString(),
      };
      await persist(outputDir, record);

      stage = 'cover_generation';
      await generateCoverImpl(article, path.join(outputDir, 'cover.jpg'));
      record = {
        ...record,
        status: 'cover_generated',
        lastSuccessfulState: 'cover_generated',
        coverReady: true,
        publish: storedInput.saveToWechat
          ? { status: demoMode ? 'demo_skipped' : 'pending' }
          : { status: 'local_only' },
        updatedAt: now().toISOString(),
      };
      await persist(outputDir, record);

      if (storedInput.saveToWechat && !demoMode) {
        stage = 'draft_creation';
        const publishData = await addDraftImpl({
          article,
          html,
          coverFile: path.join(outputDir, 'cover.jpg'),
          author: storedInput.author,
        });
        record = {
          ...record,
          status: 'draft_created',
          lastSuccessfulState: 'draft_created',
          publish: { status: 'draft_created', ...publishData },
          updatedAt: now().toISOString(),
        };
        await persist(outputDir, record);
      }

      return responseResult(record, article, html);
    } catch (error) {
      const lastSuccessfulState = record.lastSuccessfulState;
      record = {
        ...record,
        status: 'failed',
        lastSuccessfulState,
        publish: stage === 'draft_creation' ? { status: 'failed' } : record.publish,
        error: { stage, message: error.message || '生成流程失败' },
        updatedAt: now().toISOString(),
      };
      await persist(outputDir, record);
      throw new PipelineError(record.error.message, responseResult(record, article, html));
    }
  }

  async function retryDraft(id, overrides = {}) {
    const outputDir = resolveResultDir(outputRoot, id);
    let record;
    let article;
    let html;
    try {
      [record, article, html] = await Promise.all([
        readJson(path.join(outputDir, 'result.json')),
        readJson(path.join(outputDir, 'article.json')),
        fs.readFile(path.join(outputDir, 'article.html'), 'utf8'),
      ]);
    } catch (error) {
      if (error.code === 'ENOENT') throw new PipelineError('找不到可重试的生成结果', null, 404);
      throw error;
    }

    if (record.status === 'draft_created') return responseResult(record, article, html);
    if (!record.coverReady) throw new PipelineError('封面尚未生成，不能重试草稿上传', responseResult(record, article, html), 409);
    if (demoMode) {
      const demoRecord = {
        ...record,
        status: 'cover_generated',
        lastSuccessfulState: 'cover_generated',
        publish: { status: 'demo_skipped', message: '演示模式未连接公众号' },
        error: undefined,
        updatedAt: now().toISOString(),
      };
      await persist(outputDir, demoRecord);
      return responseResult(demoRecord, article, html);
    }

    try {
      const publishData = await addDraftImpl({
        article,
        html,
        coverFile: path.join(outputDir, 'cover.jpg'),
        author: String(overrides.author ?? record.input?.author ?? '').slice(0, 16),
      });
      const completed = {
        ...record,
        status: 'draft_created',
        lastSuccessfulState: 'draft_created',
        publish: { status: 'draft_created', ...publishData },
        error: undefined,
        updatedAt: now().toISOString(),
      };
      await persist(outputDir, completed);
      return responseResult(completed, article, html);
    } catch (error) {
      const failed = {
        ...record,
        status: 'failed',
        lastSuccessfulState: 'cover_generated',
        publish: { status: 'failed' },
        error: { stage: 'draft_creation', message: error.message || '草稿上传失败' },
        updatedAt: now().toISOString(),
      };
      await persist(outputDir, failed);
      throw new PipelineError(failed.error.message, responseResult(failed, article, html));
    }
  }

  return { runPipeline, retryDraft };
}

const defaultPipeline = createPipeline();

export const runPipeline = (...args) => defaultPipeline.runPipeline(...args);
export const retryDraft = (...args) => defaultPipeline.retryDraft(...args);

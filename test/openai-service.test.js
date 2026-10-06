import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { generateArticleWithClient, generateCoverWithClient } from '../src/openai-service.js';
import { articleLength } from '../src/render.js';

function makeArticle(paragraphSize, overrides = {}) {
  return {
    title: overrides.title || '一个可执行的公众号选题',
    digest: overrides.digest || '这是一段清楚、克制的文章摘要。',
    lead: '先从读者真正遇到的问题开始。',
    sections: [1, 2, 3].map((index) => ({
      heading: `第${index}部分`,
      paragraphs: ['甲'.repeat(paragraphSize), '乙'.repeat(paragraphSize)],
    })),
    conclusion: '把方法落实到一次真实行动，再根据结果持续调整。',
    callToAction: '欢迎收藏并分享你的实践。',
    coverPrompt: '简洁、有呼吸感的横版编辑插画',
  };
}

test('文章字数不合格时自动重写一次，并限制标题摘要长度', async () => {
  const responses = [
    makeArticle(10),
    makeArticle(220, { title: '题'.repeat(80), digest: '摘'.repeat(140) }),
  ];
  const calls = [];
  const client = {
    responses: {
      create: async (request) => {
        calls.push(request);
        return { output_text: JSON.stringify(responses.shift()) };
      },
    },
  };

  const article = await generateArticleWithClient(client, '测试选题');
  assert.equal(calls.length, 2);
  assert.match(calls[1].input, /上一稿实际为/);
  assert.equal(article.title.length, 64);
  assert.equal(article.digest.length, 120);
  assert.ok(articleLength(article) >= 1300 && articleLength(article) <= 1700);
  assert.equal(calls[0].store, false);
});

test('两次字数都不合格时返回明确错误', async () => {
  let calls = 0;
  const client = {
    responses: {
      create: async () => {
        calls += 1;
        return { output_text: JSON.stringify(makeArticle(10)) };
      },
    },
  };
  await assert.rejects(() => generateArticleWithClient(client, '测试选题'), /自动重写后仍为/);
  assert.equal(calls, 2);
});

test('OpenAI 请求失败时原样终止，不伪造结果', async () => {
  const client = { responses: { create: async () => { throw new Error('upstream unavailable'); } } };
  await assert.rejects(() => generateArticleWithClient(client, '测试选题'), /upstream unavailable/);
});

test('图片接口结果被压缩为 1536x656 JPEG', async () => {
  const source = await sharp({
    create: { width: 768, height: 328, channels: 3, background: '#145a4a' },
  }).jpeg().toBuffer();
  const client = { images: { generate: async () => ({ data: [{ b64_json: source.toString('base64') }] }) } };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-cover-test-'));
  const file = path.join(dir, 'cover.jpg');
  await generateCoverWithClient(client, makeArticle(220), file);
  const metadata = await sharp(file).metadata();
  assert.deepEqual([metadata.width, metadata.height, metadata.format], [1536, 656, 'jpeg']);
});

test('图片接口缺少图像数据时返回明确错误', async () => {
  const client = { images: { generate: async () => ({ data: [] }) } };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-cover-test-'));
  await assert.rejects(
    () => generateCoverWithClient(client, makeArticle(220), path.join(dir, 'cover.jpg')),
    /没有返回封面数据/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoArticle } from '../src/demo.js';
import { ARTICLE_MAX_LENGTH, ARTICLE_MIN_LENGTH } from '../src/openai-service.js';
import { articleLength, articleToHtml } from '../src/render.js';

test('演示文章长度接近 1500 字', () => {
  const article = createDemoArticle('小店如何做好内容运营');
  const length = articleLength(article);
  assert.ok(length >= ARTICLE_MIN_LENGTH && length <= ARTICLE_MAX_LENGTH, `实际长度 ${length}`);
});

test('渲染时转义不可信内容', () => {
  const article = createDemoArticle('<script>alert(1)</script>');
  const html = articleToHtml(article);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

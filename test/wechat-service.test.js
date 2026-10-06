import test from 'node:test';
import assert from 'node:assert/strict';
import { createWechatService } from '../src/wechat-service.js';

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, statusText: ok ? 'OK' : 'Error', json: async () => data };
}

function articleInput() {
  return {
    article: { title: '测试标题', digest: '测试摘要' },
    html: '<p>正文</p>',
    coverFile: '/tmp/cover.jpg',
    author: '作者',
  };
}

test('公众号令牌、封面和草稿接口按顺序调用，令牌被缓存', async () => {
  const calls = [];
  const responses = [
    jsonResponse({ access_token: 'token-1', expires_in: 7200 }),
    jsonResponse({ media_id: 'cover-1' }),
    jsonResponse({ media_id: 'draft-1' }),
  ];
  const service = createWechatService({
    appId: 'app-id',
    appSecret: 'secret',
    readFile: async () => Buffer.from('jpeg'),
    now: () => 1000,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return responses.shift();
    },
  });

  const result = await service.addDraft(articleInput());
  assert.deepEqual(result, { draftMediaId: 'draft-1', coverMediaId: 'cover-1' });
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /cgi-bin\/token/);
  assert.match(calls[1].url, /material\/add_material/);
  assert.match(calls[2].url, /draft\/add/);
  const payload = JSON.parse(calls[2].options.body);
  assert.equal(payload.articles[0].thumb_media_id, 'cover-1');
});

test('公众号令牌失败时返回可读错误', async () => {
  const service = createWechatService({
    appId: 'app-id', appSecret: 'secret',
    fetchImpl: async () => jsonResponse({ errcode: 40013, errmsg: 'invalid appid' }),
  });
  await assert.rejects(() => service.getAccessToken(), /获取公众号 access_token失败：40013 invalid appid/);
});

test('封面素材失败时不继续创建草稿', async () => {
  let calls = 0;
  const service = createWechatService({
    appId: 'app-id', appSecret: 'secret', readFile: async () => Buffer.from('jpeg'),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse({ access_token: 'token-1', expires_in: 7200 })
        : jsonResponse({ errcode: 40007, errmsg: 'invalid media' });
    },
  });
  await assert.rejects(() => service.addDraft(articleInput()), /上传封面素材失败/);
  assert.equal(calls, 2);
});

test('草稿创建失败时返回草稿阶段错误', async () => {
  const responses = [
    jsonResponse({ access_token: 'token-1', expires_in: 7200 }),
    jsonResponse({ media_id: 'cover-1' }),
    jsonResponse({ errcode: 48001, errmsg: 'api unauthorized' }),
  ];
  const service = createWechatService({
    appId: 'app-id', appSecret: 'secret', readFile: async () => Buffer.from('jpeg'),
    fetchImpl: async () => responses.shift(),
  });
  await assert.rejects(() => service.addDraft(articleInput()), /新建公众号草稿失败：48001 api unauthorized/);
});

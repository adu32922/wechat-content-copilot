import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

async function parseWechatResponse(response, action) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${action}失败：公众号接口没有返回有效 JSON`);
  }
  if (!response.ok || data.errcode) {
    throw new Error(`${action}失败：${data.errcode ?? response.status} ${data.errmsg ?? response.statusText}`);
  }
  return data;
}

export function createWechatService(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const readFile = options.readFile || fs.readFile;
  const appId = options.appId ?? config.wechatAppId;
  const appSecret = options.appSecret ?? config.wechatAppSecret;
  const now = options.now || Date.now;
  let tokenCache = { token: '', expiresAt: 0 };

  async function getAccessToken() {
    if (tokenCache.token && now() < tokenCache.expiresAt) return tokenCache.token;
    if (!appId || !appSecret) throw new Error('缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET');

    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', appId);
    url.searchParams.set('secret', appSecret);
    const data = await parseWechatResponse(await fetchImpl(url), '获取公众号 access_token');
    if (!data.access_token) throw new Error('获取公众号 access_token 成功，但返回值为空');
    tokenCache = {
      token: data.access_token,
      expiresAt: now() + Math.max(60, Number(data.expires_in || 7200) - 300) * 1000,
    };
    return tokenCache.token;
  }

  async function uploadCover(coverFile) {
    const token = await getAccessToken();
    const form = new FormData();
    const bytes = await readFile(coverFile);
    form.append('media', new Blob([bytes], { type: 'image/jpeg' }), path.basename(coverFile));
    const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${encodeURIComponent(token)}&type=image`;
    const data = await parseWechatResponse(await fetchImpl(url, { method: 'POST', body: form }), '上传封面素材');
    if (!data.media_id) throw new Error('上传封面成功，但未返回 media_id');
    return data.media_id;
  }

  async function addDraft({ article, html, coverFile, author = '' }) {
    if (!article?.title || !article?.digest || !html || !coverFile) throw new Error('草稿内容不完整');
    const token = await getAccessToken();
    const thumbMediaId = await uploadCover(coverFile);
    const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(token)}`;
    const payload = {
      articles: [{
        title: article.title.slice(0, 64),
        author: String(author).slice(0, 16),
        digest: article.digest.slice(0, 120),
        content: html,
        content_source_url: '',
        thumb_media_id: thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0,
      }],
    };
    const data = await parseWechatResponse(await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    }), '新建公众号草稿');
    if (!data.media_id) throw new Error('新建草稿成功，但未返回 media_id');
    return { draftMediaId: data.media_id, coverMediaId: thumbMediaId };
  }

  return { getAccessToken, uploadCover, addDraft };
}

const defaultService = createWechatService();

export const getAccessToken = (...args) => defaultService.getAccessToken(...args);
export const uploadCover = (...args) => defaultService.uploadCover(...args);
export const addDraft = (...args) => defaultService.addDraft(...args);

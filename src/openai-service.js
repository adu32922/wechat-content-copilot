import OpenAI from 'openai';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { config } from './config.js';
import { createDemoArticle } from './demo.js';
import { articleLength } from './render.js';
import { escapeHtml } from './utils.js';

export const ARTICLE_MIN_LENGTH = 1300;
export const ARTICLE_MAX_LENGTH = 1700;

const articleSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    digest: { type: 'string' },
    lead: { type: 'string' },
    sections: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          paragraphs: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
        },
        required: ['heading', 'paragraphs'],
        additionalProperties: false,
      },
    },
    conclusion: { type: 'string' },
    callToAction: { type: 'string' },
    coverPrompt: { type: 'string' },
  },
  required: ['title', 'digest', 'lead', 'sections', 'conclusion', 'callToAction', 'coverPrompt'],
  additionalProperties: false,
};

function client() {
  if (!config.openaiApiKey) throw new Error('缺少 OPENAI_API_KEY');
  return new OpenAI({ apiKey: config.openaiApiKey });
}

function normalizeArticle(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.sections)) {
    throw new Error('文字模型返回的文章结构无效');
  }
  if (value.sections.length < 3 || value.sections.length > 5) {
    throw new Error('文章应包含 3-5 个小标题');
  }
  const article = {
    title: String(value.title || '').trim().slice(0, 64),
    digest: String(value.digest || '').trim().slice(0, 120),
    lead: String(value.lead || '').trim(),
    sections: value.sections.map((section) => ({
      heading: String(section?.heading || '').trim(),
      paragraphs: Array.isArray(section?.paragraphs)
        ? section.paragraphs.map((paragraph) => String(paragraph || '').trim()).filter(Boolean)
        : [],
    })),
    conclusion: String(value.conclusion || '').trim(),
    callToAction: String(value.callToAction || '').trim(),
    coverPrompt: String(value.coverPrompt || '').trim(),
  };
  if (!article.title || !article.digest || !article.lead || !article.conclusion || !article.callToAction || !article.coverPrompt) {
    throw new Error('文字模型返回的文章字段不完整');
  }
  if (article.sections.some((section) => !section.heading || section.paragraphs.length < 2)) {
    throw new Error('文章小标题或段落不完整');
  }
  return article;
}

function buildArticlePrompt(topic, options, retryNote = '') {
  return `请为微信公众号写一篇文章。
选题：${topic}
目标读者：${options.audience || '普通读者'}
语气：${options.tone || '专业、亲切、具体，不夸张'}
补充要求：${options.notes || '无'}

要求：全文约 1500 个中文字符，必须控制在 ${ARTICLE_MIN_LENGTH}-${ARTICLE_MAX_LENGTH} 字；标题有吸引力但不标题党；开头快速进入读者场景；使用 3-5 个清晰小标题；观点具体，有例子和行动建议；不编造数据、案例、采访或来源；结尾自然引导收藏或留言。digest 不超过 120 个中文字符。coverPrompt 要描述一张无文字、无品牌标志、无水印的微信公众号横版封面，画面为主题服务并留有呼吸感。${retryNote}`;
}

export async function generateArticleWithClient(openai, topic, options = {}, settings = {}) {
  const model = settings.model || config.textModel;
  let lastLength = 0;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryNote = attempt === 0
      ? ''
      : `\n上一稿实际为 ${lastLength} 字，不符合长度要求。请重新完整写作，不要只补充说明，并严格落在 ${ARTICLE_MIN_LENGTH}-${ARTICLE_MAX_LENGTH} 字。`;
    const result = await openai.responses.create({
      model,
      instructions: '你是资深微信公众号主编。输出简体中文，尊重事实，不虚构权威背书。',
      input: buildArticlePrompt(topic, options, retryNote),
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'wechat_article',
          strict: true,
          schema: articleSchema,
        },
      },
    });

    let parsed;
    try {
      parsed = JSON.parse(result.output_text);
    } catch {
      throw new Error('文字模型没有返回有效 JSON');
    }
    const article = normalizeArticle(parsed);
    lastLength = articleLength(article);
    if (lastLength >= ARTICLE_MIN_LENGTH && lastLength <= ARTICLE_MAX_LENGTH) return article;
  }

  throw new Error(`文章自动重写后仍为 ${lastLength} 字，不在 ${ARTICLE_MIN_LENGTH}-${ARTICLE_MAX_LENGTH} 字范围内`);
}

export async function generateArticle(topic, options = {}) {
  if (config.demoMode) return normalizeArticle(createDemoArticle(topic, options));
  return generateArticleWithClient(client(), topic, options);
}

export async function generateCoverWithClient(openai, article, outputFile, settings = {}) {
  const response = await openai.images.generate({
    model: settings.model || config.imageModel,
    prompt: `${article.coverPrompt}\n用途：微信公众号文章封面。横版 2.35:1，主体醒目，边缘留安全空间。禁止文字、字母、数字、品牌标志和水印。`,
    size: '1536x656',
    quality: 'medium',
    output_format: 'jpeg',
  });
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw new Error('图片接口没有返回封面数据');
  await fs.writeFile(outputFile, Buffer.from(encoded, 'base64'));
  await sharp(outputFile).resize(1536, 656, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(`${outputFile}.optimized.jpg`);
  await fs.rename(`${outputFile}.optimized.jpg`, outputFile);
}

export async function generateCover(article, outputFile) {
  if (config.demoMode) {
    const compactTitle = article.title.length > 34 ? `${article.title.slice(0, 34)}…` : article.title;
    const splitAt = Math.min(18, compactTitle.length);
    const lineOne = escapeHtml(compactTitle.slice(0, splitAt));
    const lineTwo = escapeHtml(compactTitle.slice(splitAt));
    const svg = `<svg width="1536" height="656" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0d5c4d"/><stop offset="1" stop-color="#ef8f3c"/></linearGradient></defs>
      <rect width="1536" height="656" fill="url(#g)"/><circle cx="1280" cy="120" r="240" fill="#fff" opacity=".12"/><circle cx="230" cy="620" r="330" fill="#fff" opacity=".08"/>
      <text x="100" y="245" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="58" font-weight="700" fill="#fff"><tspan x="100" dy="0">${lineOne}</tspan><tspan x="100" dy="86">${lineTwo}</tspan></text>
      <text x="104" y="432" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="30" fill="#fff" opacity=".85">把复杂问题，讲得清楚又有用</text>
    </svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(outputFile);
    return;
  }

  await generateCoverWithClient(client(), article, outputFile);
}

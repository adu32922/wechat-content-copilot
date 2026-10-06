import { escapeHtml, plainTextLength } from './utils.js';

export function articleToHtml(article) {
  const sections = article.sections.map((section) => {
    const paragraphs = section.paragraphs
      .map((paragraph) => `<p style="margin:0 0 18px;line-height:1.9;color:#2f3437;font-size:16px;letter-spacing:.3px;">${escapeHtml(paragraph)}</p>`)
      .join('');
    return `<section style="margin:28px 0;"><h2 style="margin:0 0 16px;font-size:20px;line-height:1.5;color:#145a4a;border-left:4px solid #ef8f3c;padding-left:12px;">${escapeHtml(section.heading)}</h2>${paragraphs}</section>`;
  }).join('');

  return `<section style="max-width:677px;margin:0 auto;padding:12px 8px;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
  <p style="margin:0 0 24px;padding:16px 18px;background:#f4f8f6;border-radius:8px;line-height:1.85;color:#49615a;font-size:15px;">${escapeHtml(article.lead)}</p>
  ${sections}
  <section style="margin-top:30px;padding:20px 18px;background:#fff6ed;border-radius:8px;">
    <p style="margin:0 0 12px;line-height:1.9;color:#2f3437;font-size:16px;">${escapeHtml(article.conclusion)}</p>
    <p style="margin:0;color:#c56722;font-weight:600;font-size:16px;line-height:1.8;">${escapeHtml(article.callToAction)}</p>
  </section>
</section>`;
}

export function articlePlainText(article) {
  return [
    article.title,
    article.lead,
    ...article.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    article.conclusion,
    article.callToAction,
  ].join('\n\n');
}

export function articleLength(article) {
  return plainTextLength(articlePlainText(article));
}

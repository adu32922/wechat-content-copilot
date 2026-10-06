import fs from 'node:fs/promises';
import path from 'node:path';

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function plainTextLength(value = '') {
  return String(value).replace(/\s/g, '').length;
}

export function slugify(value = '') {
  const clean = String(value)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 36);
  return clean || 'untitled';
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temp, file);
}

export function timestampName(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

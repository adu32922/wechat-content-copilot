import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { config } from './config.js';
import { writeJson } from './utils.js';

export async function getTopics() {
  try {
    return JSON.parse(await fs.readFile(config.topicsFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function createTopicRecord(input, options = {}) {
  const topic = String(input.topic || '').trim();
  if (topic.length < 2 || topic.length > 120) throw new Error('选题长度应为 2-120 个字符');
  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error('执行时间无效');
  const now = options.now || new Date();
  return {
    id: options.id || crypto.randomUUID(),
    topic,
    audience: String(input.audience || ''),
    tone: String(input.tone || ''),
    notes: String(input.notes || ''),
    author: String(input.author || ''),
    saveToWechat: input.saveToWechat !== false,
    scheduledAt: scheduledAt.toISOString(),
    status: 'pending',
    createdAt: now.toISOString(),
  };
}

export function applyTopicPatch(items, id, patch, now = new Date()) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('队列任务不存在');
  const allowedStatuses = new Set(['pending', 'running', 'completed', 'failed']);
  if (patch.status && !allowedStatuses.has(patch.status)) throw new Error('队列任务状态无效');
  const updated = items.slice();
  updated[index] = { ...updated[index], ...patch, updatedAt: now.toISOString() };
  return updated;
}

export async function addTopic(input) {
  const items = await getTopics();
  const item = createTopicRecord(input);
  items.push(item);
  await writeJson(config.topicsFile, items);
  return item;
}

export async function updateTopic(id, patch) {
  const items = await getTopics();
  const updated = applyTopicPatch(items, id, patch);
  await writeJson(config.topicsFile, updated);
  return updated.find((item) => item.id === id);
}

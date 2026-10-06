import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTopicPatch, createTopicRecord } from '../src/queue.js';

test('队列任务从待执行转换为执行中和已完成', () => {
  const created = createTopicRecord({
    topic: '社区小店如何提高复购',
    scheduledAt: '2026-09-30T10:00:00+08:00',
  }, { id: 'topic-1', now: new Date('2026-09-29T00:00:00Z') });
  assert.equal(created.status, 'pending');
  const running = applyTopicPatch([created], 'topic-1', { status: 'running' }, new Date('2026-09-29T01:00:00Z'));
  const completed = applyTopicPatch(running, 'topic-1', { status: 'completed', resultId: 'result-1' }, new Date('2026-09-29T02:00:00Z'));
  assert.equal(completed[0].status, 'completed');
  assert.equal(completed[0].resultId, 'result-1');
});

test('拒绝未知队列状态', () => {
  const item = createTopicRecord({ topic: '测试选题', scheduledAt: '2026-09-30T10:00:00+08:00' }, { id: 'topic-1' });
  assert.throws(() => applyTopicPatch([item], 'topic-1', { status: 'unknown' }), /状态无效/);
});

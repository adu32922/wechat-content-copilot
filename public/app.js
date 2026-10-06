const $ = (selector) => document.querySelector(selector);
const form = $('#generate-form');
const queueForm = $('#queue-form');
let currentResult = null;

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4200);
}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || '请求失败');
    error.result = data.result;
    throw error;
  }
  return data;
}

function formDataToObject(target) {
  const data = Object.fromEntries(new FormData(target));
  data.saveToWechat = target.elements.saveToWechat?.checked ?? true;
  return data;
}

async function loadStatus() {
  const status = await api('/api/status');
  const el = $('#status');
  if (status.demoMode) el.textContent = '演示模式 · 不连接外部服务';
  else if (status.openaiReady && status.wechatReady) el.textContent = 'AI 与公众号已配置';
  else el.textContent = '配置未完成';
}

function showResult(result) {
  currentResult = result;
  $('#loading').classList.add('hidden');
  $('#empty-preview').classList.add('hidden');
  $('#result').classList.remove('hidden');
  const cover = $('#cover');
  cover.classList.toggle('hidden', !result.coverUrl);
  if (result.coverUrl) cover.src = `${result.coverUrl}?v=${Date.now()}`;
  $('#article-title').textContent = result.title || result.topic || '生成未完成';
  $('#digest').textContent = result.digest || '';
  $('#article-body').innerHTML = result.html || '';
  $('#length').textContent = result.articleLength ? `约 ${result.articleLength} 字` : '正文未完成';
  const states = {
    not_requested: '尚未上传',
    local_only: '仅本地预览',
    pending: '等待上传',
    failed: '草稿上传失败',
    demo_skipped: '演示模式 · 未上传',
    draft_created: '已进入公众号草稿箱',
  };
  $('#publish-state').textContent = states[result.publish?.status] || result.status;
  const errorBox = $('#result-error');
  errorBox.textContent = result.error?.message || '';
  errorBox.classList.toggle('hidden', !result.error?.message);
  const canRetryDraft = result.coverReady && result.status === 'failed' && result.error?.stage === 'draft_creation';
  $('#retry-draft').classList.toggle('hidden', !canRetryDraft);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  $('#empty-preview').classList.add('hidden');
  $('#result').classList.add('hidden');
  $('#loading').classList.remove('hidden');
  try {
    const result = await api('/api/generate', { method: 'POST', body: JSON.stringify(formDataToObject(form)) });
    showResult(result);
    toast(result.publish.status === 'draft_created' ? '生成完成，已存入公众号草稿箱' : '生成完成，已保存到本地');
  } catch (error) {
    $('#loading').classList.add('hidden');
    if (error.result) showResult(error.result);
    else $('#empty-preview').classList.remove('hidden');
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});

$('#retry-draft').addEventListener('click', async () => {
  if (!currentResult?.id) return;
  const button = $('#retry-draft');
  button.disabled = true;
  try {
    const result = await api(`/api/results/${encodeURIComponent(currentResult.id)}/retry-draft`, {
      method: 'POST',
      body: JSON.stringify({ author: form.elements.author.value }),
    });
    showResult(result);
    toast(result.publish.status === 'draft_created' ? '草稿上传成功' : '演示模式未连接公众号');
  } catch (error) {
    if (error.result) showResult(error.result);
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});

const labels = { pending: '待执行', running: '执行中', completed: '已完成', failed: '失败' };
async function loadQueue() {
  const items = await api('/api/topics');
  $('#queue-list').innerHTML = items.length ? items.slice().reverse().map((item) => `
    <div class="queue-item"><div><h4>${escapeHtml(item.topic)}</h4><p>${new Date(item.scheduledAt).toLocaleString()}${item.lastError ? ` · ${escapeHtml(item.lastError)}` : ''}</p></div><span class="badge">${labels[item.status] || item.status}</span></div>
  `).join('') : '<div class="queue-item"><p>还没有自动选题。</p></div>';
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = value || '';
  return node.innerHTML;
}

queueForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = Object.fromEntries(new FormData(queueForm));
    payload.saveToWechat = true;
    await api('/api/topics', { method: 'POST', body: JSON.stringify(payload) });
    queueForm.reset();
    await loadQueue();
    toast('已加入自动选题队列');
  } catch (error) { toast(error.message); }
});

const nextHour = new Date(Date.now() + 60 * 60 * 1000);
nextHour.setMinutes(0, 0, 0);
queueForm.elements.scheduledAt.value = new Date(nextHour.getTime() - nextHour.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
Promise.all([loadStatus(), loadQueue()]).catch((error) => toast(error.message));

// 注意：本文件的时间戳检测/格式化/历史写入逻辑必须与 src/lib/timestamp.ts 保持一致。
// 修改任一处的判断阈值或 localStorage 结构时请同步另一处。

const HISTORY_KEY = 'devtext:timestamp-history';
const HISTORY_LIMIT = 50;

function detectTimestampType(input) {
  const s = String(input).trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs >= 1e12) return 'milliseconds';
  if (s.length === 13) return 'milliseconds';
  if (s.length === 10) return 'seconds';
  return 'seconds';
}

function pad(n, w) {
  return String(n).padStart(w || 2, '0');
}

function formatDate(date) {
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function addHistory(entry) {
  let list = [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }
  } catch (_) {}
  const full = Object.assign({}, entry, { id: genId(), createdAt: Date.now() });
  list = [full].concat(list).slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (_) {}
}

// --- 渲染 ---
const cbBody = document.getElementById('cbBody');
const cbBadge = document.getElementById('cbBadge');

function showEmpty(message) {
  cbBadge.style.display = 'none';
  cbBody.innerHTML = `<div class="cb-empty">${message}</div>`;
}

function showResult(raw, type, formatted, msValue) {
  cbBadge.style.display = '';
  cbBadge.textContent = type === 'seconds' ? '秒级' : '毫秒级';

  cbBody.innerHTML = `
    <div class="cb-raw">${raw}</div>
    <div class="cb-result">${formatted}</div>
    <button class="cb-copy" id="cbCopyBtn">复制时间</button>
  `;

  const btn = document.getElementById('cbCopyBtn');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制时间';
        btn.classList.remove('copied');
      }, 1200);
    } catch (e) {
      btn.textContent = '复制失败';
    }
  });
}

// Chrome 扩展 popup 中 navigator.clipboard.readText() 经常因缺少用户手势被拒。
// execCommand('paste') 在扩展上下文里只要 manifest 有 clipboardRead 权限就能稳定工作，
// 配合一个隐藏 textarea 即可同步读取。失败时回退到 navigator API 或显示手动按钮。
function readClipboardSync() {
  const ta = document.createElement('textarea');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.left = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  let value = '';
  let ok = false;
  try {
    ok = document.execCommand('paste');
    value = ta.value;
  } catch (_) {}
  document.body.removeChild(ta);
  return ok ? value : null;
}

async function readClipboard() {
  // 1) execCommand 路径（最稳）
  const sync = readClipboardSync();
  if (sync !== null) return sync;
  // 2) async API 路径（带用户手势时可能成功）
  return await navigator.clipboard.readText();
}

function showManualButton() {
  cbBadge.style.display = 'none';
  cbBody.innerHTML = `
    <div class="cb-empty" style="margin-bottom:8px">需要手动触发剪贴板读取</div>
    <button class="cb-copy" id="cbReadBtn">读取剪贴板</button>
  `;
  document.getElementById('cbReadBtn').addEventListener('click', () => init());
}

function handleText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    showEmpty('剪贴板为空');
    return;
  }
  const type = detectTimestampType(trimmed);
  if (!type) {
    showEmpty('剪贴板内容不是时间戳');
    return;
  }
  const ms = type === 'seconds' ? Number(trimmed) * 1000 : Number(trimmed);
  const date = new Date(ms);
  if (isNaN(date.getTime())) {
    showEmpty('时间戳超出有效范围');
    return;
  }
  const formatted = formatDate(date);
  showResult(trimmed, type, formatted, ms);

  addHistory({
    input: trimmed,
    direction: 'ts2date',
    outputs: [
      { label: '本地时间', value: formatted },
      { label: '毫秒时间戳', value: String(ms) },
      { label: '秒级时间戳', value: String(Math.floor(ms / 1000)) }
    ],
    source: 'popup'
  });
}

async function init() {
  try {
    const text = await readClipboard();
    handleText(text);
  } catch (e) {
    showManualButton();
  }
}

init();

// 点击按钮打开格式化工具
document.getElementById('openTool').addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});

// 也可以通过快捷键打开
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html')
    });
  }
});

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { copyToClipboard } from '../lib/utils'
import {
  detectTimestampType,
  timestampToDate,
  formatDate,
  parseDateInput,
  getHistory,
  addHistory,
  clearHistory,
  getHistoryEnabled,
  setHistoryEnabled,
  HISTORY_KEY,
  type HistoryEntry,
  type TimestampUnit
} from '../lib/timestamp'

// --- 块 a：实时时钟 ---
const now = ref(new Date())
let timerId: number | undefined

const currentTimeText = computed(() => formatDate(now.value))
const currentMs = computed(() => now.value.getTime())

// --- 块 b：双向转换 ---
type Mode = 'auto' | 'seconds' | 'milliseconds' | 'date'
const mode = ref<Mode>('auto')
const inputText = ref('')

const modeOptions: { value: Mode; label: string }[] = [
  { value: 'auto', label: '自动检测' },
  { value: 'seconds', label: '秒' },
  { value: 'milliseconds', label: '毫秒' },
  { value: 'date', label: '日期字符串' }
]

interface ConvertResult {
  ok: boolean
  message?: string
  outputs?: { label: string; value: string }[]
  direction?: 'ts2date' | 'date2ts'
}

const convertResult = computed<ConvertResult>(() => {
  const raw = inputText.value.trim()
  if (!raw) return { ok: false }

  // 决定本次按哪种方向处理
  let direction: 'ts2date' | 'date2ts'
  let unit: TimestampUnit | null = null

  if (mode.value === 'auto') {
    const detected = detectTimestampType(raw)
    if (detected) {
      direction = 'ts2date'
      unit = detected
    } else if (parseDateInput(raw)) {
      direction = 'date2ts'
    } else {
      return { ok: false, message: '无法识别输入：既不是有效时间戳，也不是可解析的日期字符串' }
    }
  } else if (mode.value === 'seconds' || mode.value === 'milliseconds') {
    if (!/^-?\d+$/.test(raw)) return { ok: false, message: '当前模式要求输入纯数字时间戳' }
    direction = 'ts2date'
    unit = mode.value
  } else {
    direction = 'date2ts'
  }

  if (direction === 'ts2date') {
    const n = Number(raw)
    if (!Number.isFinite(n)) return { ok: false, message: '数字越界' }
    const date = timestampToDate(n, unit!)
    if (Number.isNaN(date.getTime())) return { ok: false, message: '时间戳无效' }
    const ms = date.getTime()
    return {
      ok: true,
      direction,
      outputs: [
        { label: '本地时间', value: formatDate(date) },
        { label: '毫秒时间戳', value: String(ms) },
        { label: '秒级时间戳', value: String(Math.floor(ms / 1000)) }
      ]
    }
  } else {
    const date = parseDateInput(raw)
    if (!date) return { ok: false, message: '日期格式无法解析' }
    const ms = date.getTime()
    return {
      ok: true,
      direction,
      outputs: [
        { label: '毫秒时间戳', value: String(ms) },
        { label: '秒级时间戳', value: String(Math.floor(ms / 1000)) },
        { label: '本地时间（规范化）', value: formatDate(date) }
      ]
    }
  }
})

// 自动保存开关（持久化到 localStorage）
const autoSave = ref(getHistoryEnabled())
watch(autoSave, (v) => setHistoryEnabled(v))

// 记录已写入历史的输入指纹，避免每次 input 抖动都入库
const lastSavedKey = ref('')
function recordIfNew() {
  const r = convertResult.value
  if (!r.ok || !r.outputs || !r.direction) return
  const key = `${r.direction}|${inputText.value.trim()}`
  if (key === lastSavedKey.value) return
  lastSavedKey.value = key
  addHistory({
    input: inputText.value.trim(),
    direction: r.direction,
    outputs: r.outputs,
    source: 'main'
  })
  refreshHistory()
}

// 自动保存：转换结果变化时（去重后）入库
watch(convertResult, (r) => {
  if (!autoSave.value) return
  if (r.ok) recordIfNew()
})

// --- 块 c：历史 ---
const history = ref<HistoryEntry[]>([])
function refreshHistory() {
  history.value = getHistory()
}

function onClearHistory() {
  if (history.value.length === 0) return
  if (!confirm('确认清空全部转换历史？')) return
  clearHistory()
  refreshHistory()
}

function onStorage(e: StorageEvent) {
  if (e.key === HISTORY_KEY) refreshHistory()
}

// --- 复制反馈 ---
const copiedKey = ref('')
async function copy(value: string, key: string) {
  await copyToClipboard(value)
  copiedKey.value = key
  setTimeout(() => {
    if (copiedKey.value === key) copiedKey.value = ''
  }, 1200)
}

function formatRelTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  return `${Math.floor(diff / 86400_000)} 天前`
}

onMounted(() => {
  timerId = window.setInterval(() => { now.value = new Date() }, 100)
  refreshHistory()
  window.addEventListener('storage', onStorage)
})

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
  window.removeEventListener('storage', onStorage)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- 块 a：实时时钟 -->
    <section class="bg-card border border-border rounded-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold">当前时间</h2>
        <span class="text-xs text-muted-foreground">每 100ms 刷新</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="bg-background border border-border rounded-md p-4">
          <div class="text-xs text-muted-foreground mb-2">本地时间</div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-lg text-primary">{{ currentTimeText }}</span>
            <button
              @click="copy(currentTimeText, 'now-time')"
              class="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80 transition-colors shrink-0"
            >
              {{ copiedKey === 'now-time' ? '已复制' : '复制' }}
            </button>
          </div>
        </div>
        <div class="bg-background border border-border rounded-md p-4">
          <div class="text-xs text-muted-foreground mb-2">毫秒时间戳</div>
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-lg text-primary">{{ currentMs }}</span>
            <button
              @click="copy(String(currentMs), 'now-ms')"
              class="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80 transition-colors shrink-0"
            >
              {{ copiedKey === 'now-ms' ? '已复制' : '复制' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 块 b：双向转换 -->
    <section class="bg-card border border-border rounded-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold">时间戳转换</h2>
        <button
          v-if="convertResult.ok && !autoSave"
          @click="recordIfNew"
          class="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          保存到历史
        </button>
      </div>

      <div class="flex flex-wrap gap-2 mb-3">
        <button
          v-for="opt in modeOptions"
          :key="opt.value"
          @click="mode = opt.value"
          class="px-3 py-1 text-xs rounded-full border transition-colors"
          :class="mode === opt.value
            ? 'bg-primary/20 border-primary text-primary'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'"
        >
          {{ opt.label }}
        </button>
      </div>

      <input
        v-model="inputText"
        type="text"
        placeholder="输入时间戳（如 1717200000）或日期字符串（如 2024-06-01 12:00:00）"
        class="w-full px-3 py-2 rounded-md bg-background border border-border font-mono text-sm focus:outline-none focus:border-primary"
      />

      <div v-if="inputText.trim()" class="mt-4">
        <div v-if="!convertResult.ok" class="text-sm text-destructive">
          {{ convertResult.message || '请输入要转换的内容' }}
        </div>
        <div v-else class="flex flex-col gap-2">
          <div
            v-for="out in convertResult.outputs"
            :key="out.label"
            class="flex items-center justify-between gap-3 bg-background border border-border rounded-md px-3 py-2"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-xs text-muted-foreground shrink-0 w-24">{{ out.label }}</span>
              <span class="font-mono text-sm truncate">{{ out.value }}</span>
            </div>
            <button
              @click="copy(out.value, `cur-${out.label}`)"
              class="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80 transition-colors shrink-0"
            >
              {{ copiedKey === `cur-${out.label}` ? '已复制' : '复制' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 块 c：历史 -->
    <section class="bg-card border border-border rounded-lg p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold">
          转换历史
          <span class="text-xs text-muted-foreground ml-2 font-normal">{{ history.length }} / 50</span>
        </h2>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer select-none" :title="autoSave ? '关闭后将不再自动记录转换' : '开启后将自动记录转换'">
            <span class="text-xs text-muted-foreground">自动保存</span>
            <button
              type="button"
              role="switch"
              :aria-checked="autoSave"
              @click="autoSave = !autoSave"
              class="relative w-9 h-5 rounded-full transition-colors"
              :class="autoSave ? 'bg-primary' : 'bg-secondary'"
            >
              <span
                class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                :class="autoSave ? 'translate-x-[18px]' : 'translate-x-0.5'"
              ></span>
            </button>
          </label>
          <button
            @click="onClearHistory"
            class="px-3 py-1 text-xs rounded bg-secondary hover:bg-destructive/80 hover:text-destructive-foreground transition-colors"
          >
            清空
          </button>
        </div>
      </div>

      <div v-if="history.length === 0" class="text-sm text-muted-foreground py-8 text-center">
        暂无历史记录。完成一次转换后点"保存到历史"，或通过 popup 转换会自动入库。
      </div>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="item in history"
          :key="item.id"
          class="bg-background border border-border rounded-md p-3"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                :class="item.source === 'popup'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary text-muted-foreground'"
              >{{ item.source }}</span>
              <span class="text-xs text-muted-foreground shrink-0">
                {{ item.direction === 'ts2date' ? '时间戳→日期' : '日期→时间戳' }}
              </span>
              <span class="font-mono text-xs truncate">{{ item.input }}</span>
            </div>
            <span class="text-[10px] text-muted-foreground shrink-0">{{ formatRelTime(item.createdAt) }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="out in item.outputs"
              :key="out.label"
              @click="copy(out.value, `h-${item.id}-${out.label}`)"
              class="px-2 py-1 text-xs rounded border border-border hover:bg-secondary/60 transition-colors font-mono"
              :title="`复制：${out.value}`"
            >
              <span class="text-muted-foreground mr-1">{{ out.label }}:</span>
              <span>{{ copiedKey === `h-${item.id}-${out.label}` ? '已复制' : out.value }}</span>
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

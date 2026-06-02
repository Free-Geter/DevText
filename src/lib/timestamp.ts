/**
 * 时间戳工具库
 * 注意：popup/popup.js 内嵌了一份精简实现，修改本文件的判断/格式逻辑时请保持同步。
 * 共用 localStorage key：HISTORY_KEY
 */

export type TimestampUnit = 'seconds' | 'milliseconds'
export type ConvertDirection = 'ts2date' | 'date2ts'

export interface HistoryOutput {
  label: string
  value: string
}

export interface HistoryEntry {
  id: string
  input: string
  direction: ConvertDirection
  outputs: HistoryOutput[]
  createdAt: number
  source: 'popup' | 'main'
}

export const HISTORY_KEY = 'devtext:timestamp-history'
export const HISTORY_ENABLED_KEY = 'devtext:timestamp-history-enabled'
export const HISTORY_LIMIT = 50

/**
 * 读取"自动保存历史"开关状态，默认 true。
 */
export function getHistoryEnabled(): boolean {
  try {
    const v = localStorage.getItem(HISTORY_ENABLED_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

export function setHistoryEnabled(value: boolean): void {
  try {
    localStorage.setItem(HISTORY_ENABLED_KEY, String(value))
  } catch {
    // ignore
  }
}

/**
 * 判断字符串是秒级还是毫秒级时间戳。
 * 规则：纯数字；值 >= 1e12 视为毫秒，否则按长度判断（13→ms，10→s）。
 */
export function detectTimestampType(input: string): TimestampUnit | null {
  const s = input.trim()
  if (!/^-?\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const abs = Math.abs(n)
  if (abs >= 1e12) return 'milliseconds'
  if (s.length === 13) return 'milliseconds'
  if (s.length === 10) return 'seconds'
  // 兜底：小于 1e12 一律按秒（兼容历史早期/未来短时间戳）
  return 'seconds'
}

export function timestampToDate(value: number, unit: TimestampUnit): Date {
  return new Date(unit === 'seconds' ? value * 1000 : value)
}

/**
 * 格式化为本地时区 YYYY-MM-DD HH:mm:ss.SSS
 */
export function formatDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  )
}

/**
 * 解析日期字符串。支持：
 *  - YYYY-MM-DD HH:mm:ss[.SSS]
 *  - YYYY/MM/DD HH:mm:ss[.SSS]
 *  - ISO 8601（回退到 new Date()）
 */
export function parseDateInput(input: string): Date | null {
  const s = input.trim()
  if (!s) return null
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/)
  if (m) {
    const [, y, mo, d, h, mi, se, ms] = m
    const date = new Date(
      Number(y), Number(mo) - 1, Number(d),
      Number(h), Number(mi), Number(se),
      ms ? Number(ms.padEnd(3, '0')) : 0
    )
    return Number.isNaN(date.getTime()) ? null : date
  }
  const fallback = new Date(s)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: genId(),
    createdAt: Date.now()
  }
  const list = [full, ...getHistory()].slice(0, HISTORY_LIMIT)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {
    // 配额溢出等错误静默忽略
  }
  return full
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // ignore
  }
}

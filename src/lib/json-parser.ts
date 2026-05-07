/**
 * JSON 解析器
 * 支持错误容错的 JSON 解析器，能够处理包含转义和错误的 JSON
 */

import { processEscapes } from './escape-handler'
import { detectErrors, type JsonError } from './error-detector'

export interface ParseResult {
  success: boolean
  data: unknown
  formattedJson: string
  compressedJson: string
  errors: JsonError[]
  escapeSequences: EscapeSequenceInfo[]
}

export interface EscapeSequenceInfo {
  original: string
  replaced: string
  count: number
}

/**
 * 解析 JSON 字符串
 */
export function parseJson(input: string): ParseResult {
  // 1. 预处理：处理转义字符
  const escapeResult = processEscapes(input)
  
  // 统计转义序列
  const escapeMap = new Map<string, EscapeSequenceInfo>()
  for (const seq of escapeResult.escapeSequences) {
    const existing = escapeMap.get(seq.original)
    if (existing) {
      existing.count++
    } else {
      escapeMap.set(seq.original, {
        original: seq.original,
        replaced: seq.replaced,
        count: 1
      })
    }
  }
  
  // 2. 检测错误
  const errors = detectErrors(escapeResult.processed)
  
  // 3. 尝试修复并解析
  let data: unknown = null
  let success = false
  let formattedJson = ''
  let compressedJson = ''
  
  // 尝试直接解析
  try {
    data = JSON.parse(escapeResult.processed)
    success = true
    formattedJson = JSON.stringify(data, null, 2)
    compressedJson = JSON.stringify(data)
  } catch {
    // 尝试修复后解析
    const fixedJson = tryFixJson(escapeResult.processed)
    try {
      data = JSON.parse(fixedJson)
      success = true
      formattedJson = JSON.stringify(data, null, 2)
      compressedJson = JSON.stringify(data)
    } catch {
      // 无法解析，返回原始处理后的内容
      formattedJson = escapeResult.processed
      compressedJson = escapeResult.processed.replace(/\s+/g, ' ')
    }
  }
  
  return {
    success,
    data,
    formattedJson,
    compressedJson,
    errors,
    escapeSequences: Array.from(escapeMap.values())
  }
}

/**
 * 尝试自动修复 JSON
 */
function tryFixJson(jsonString: string): string {
  let fixed = jsonString
  
  // 1. 移除尾随逗号
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
  
  // 2. 将单引号转换为双引号
  fixed = fixed.replace(/'/g, '"')
  
  // 3. 修复缺少引号的键名
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
  
  // 4. 移除注释
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '')
  fixed = fixed.replace(/\/\/.*$/gm, '')
  
  // 5. 尝试补全缺失的闭合括号
  const openBraces = (fixed.match(/{/g) || []).length
  const closeBraces = (fixed.match(/}/g) || []).length
  const openBrackets = (fixed.match(/\[/g) || []).length
  const closeBrackets = (fixed.match(/]/g) || []).length
  
  if (openBraces > closeBraces) {
    fixed += '}'.repeat(openBraces - closeBraces)
  }
  if (openBrackets > closeBrackets) {
    fixed += ']'.repeat(openBrackets - closeBrackets)
  }
  
  return fixed
}

/**
 * 格式化 JSON 字符串
 */
export function formatJson(jsonString: string, indent: number = 2): string {
  try {
    const parsed = JSON.parse(jsonString)
    return JSON.stringify(parsed, null, indent)
  } catch {
    return jsonString
  }
}

/**
 * 压缩 JSON 字符串
 */
export function compressJson(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString)
    return JSON.stringify(parsed)
  } catch {
    return jsonString.replace(/\s+/g, ' ').trim()
  }
}

/**
 * 验证 JSON 是否有效
 */
export function isValidJson(jsonString: string): boolean {
  try {
    JSON.parse(jsonString)
    return true
  } catch {
    return false
  }
}

/**
 * 获取 JSON 值类型
 */
export function getJsonType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

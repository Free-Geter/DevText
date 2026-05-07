/**
 * 转义字符处理器
 * 处理 JSON 字符串中的各种转义序列
 */

export interface EscapeResult {
  original: string;
  processed: string;
  escapeSequences: EscapeSequence[];
}

export interface EscapeSequence {
  position: number;
  original: string;
  replaced: string;
  line: number;
  column: number;
}

// 转义字符映射表
const ESCAPE_MAP: Record<string, string> = {
  '\\n': '\n',
  '\\t': '\t',
  '\\r': '\r',
  '\\"': '"',
  "\\'": "'",
  '\\\\': '\\',
  '\\b': '\b',
  '\\f': '\f',
  '\\/': '/',
}

// Unicode 转义正则
const UNICODE_ESCAPE_REGEX = /\\u([0-9a-fA-F]{4})/g

/**
 * 处理字符串中的转义字符
 */
export function processEscapes(text: string): EscapeResult {
  const escapeSequences: EscapeSequence[] = []
  let processed = text
  let offset = 0

  // 先处理 Unicode 转义
  processed = processed.replace(UNICODE_ESCAPE_REGEX, (match, hex, offsetIndex) => {
    const char = String.fromCharCode(parseInt(hex, 16))
    const pos = offsetIndex + offset
    
    escapeSequences.push({
      position: pos,
      original: match,
      replaced: char,
      line: 1,
      column: pos + 1
    })
    
    return char
  })

  // 处理其他转义字符
  for (const [escape, replacement] of Object.entries(ESCAPE_MAP)) {
    let index = processed.indexOf(escape)
    while (index !== -1) {
      escapeSequences.push({
        position: index,
        original: escape,
        replaced: replacement,
        line: 1,
        column: index + 1
      })
      index = processed.indexOf(escape, index + 1)
    }
    processed = processed.split(escape).join(replacement)
  }

  // 更新行号和列号
  let currentLine = 1
  let lineStart = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      currentLine++
      lineStart = i + 1
    }
    for (const seq of escapeSequences) {
      if (seq.position === i) {
        seq.line = currentLine
        seq.column = i - lineStart + 1
      }
    }
  }

  return {
    original: text,
    processed,
    escapeSequences
  }
}

/**
 * 检测字符串中的转义字符
 */
export function detectEscapeSequences(text: string): EscapeSequence[] {
  const result = processEscapes(text)
  return result.escapeSequences
}

/**
 * 反转义：将特殊字符转回转义序列（用于输出）
 */
export function escapeForJson(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\b/g, '\\b')
    .replace(/\f/g, '\\f')
}

/**
 * JSON 语法高亮工具
 * 将 JSON 文本转换为带语法着色标记的 HTML
 * 用于编辑模式下的背景高亮层
 */

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 将 JSON 文本转换为带 <span> 标记的 HTML 字符串
 * 各 token 类型对应的 CSS 类名：
 *  - hl-key      键名（后跟 : 的字符串）
 *  - hl-string   字符串值
 *  - hl-number   数字
 *  - hl-boolean  true / false
 *  - hl-null     null
 *  - hl-bracket  { } [ ]
 *  - hl-colon    :
 *  - hl-comma    ,
 *  - hl-error    无法识别的字符（非法 JSON）
 */
export function highlightJson(text: string): string {
  if (!text) return ''

  let result = ''
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]

    // 空白字符直接透传
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      result += escape(ch)
      i++
      continue
    }

    // 字符串（键名或值）
    if (ch === '"') {
      let j = i + 1
      while (j < len) {
        if (text[j] === '\\') { j += 2; continue }
        if (text[j] === '"') { j++; break }
        j++
      }
      const str = text.substring(i, j)
      // 向后跳过空白看是否紧跟 : 来判断是键名还是值
      let k = j
      while (k < len && (text[k] === ' ' || text[k] === '\t' || text[k] === '\n' || text[k] === '\r')) k++
      const isKey = k < len && text[k] === ':'
      const cls = isKey ? 'hl-key' : 'hl-string'
      result += `<span class="${cls}">${escape(str)}</span>`
      i = j
      continue
    }

    // 数字
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i
      if (text[j] === '-') j++
      while (j < len && text[j] >= '0' && text[j] <= '9') j++
      if (j < len && text[j] === '.') {
        j++
        while (j < len && text[j] >= '0' && text[j] <= '9') j++
      }
      if (j < len && (text[j] === 'e' || text[j] === 'E')) {
        j++
        if (j < len && (text[j] === '+' || text[j] === '-')) j++
        while (j < len && text[j] >= '0' && text[j] <= '9') j++
      }
      result += `<span class="hl-number">${escape(text.substring(i, j))}</span>`
      i = j
      continue
    }

    // true / false / null
    if (text.startsWith('true', i)) {
      result += '<span class="hl-boolean">true</span>'
      i += 4; continue
    }
    if (text.startsWith('false', i)) {
      result += '<span class="hl-boolean">false</span>'
      i += 5; continue
    }
    if (text.startsWith('null', i)) {
      result += '<span class="hl-null">null</span>'
      i += 4; continue
    }

    // 括号
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      result += `<span class="hl-bracket">${ch}</span>`
      i++; continue
    }
    if (ch === ',') {
      result += '<span class="hl-comma">,</span>'
      i++; continue
    }
    if (ch === ':') {
      result += '<span class="hl-colon">:</span>'
      i++; continue
    }

    // 无法识别的字符（非法 JSON）
    result += `<span class="hl-error">${escape(ch)}</span>`
    i++
  }

  // 末尾换行：部分浏览器对尾部 \n 是否生成额外行处理不一致，补一个空格确保高亮层和 textarea 滚动高度一致
  if (text.endsWith('\n')) {
    result += '\n'
  }

  return result
}

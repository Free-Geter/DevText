/**
 * JSON 错误检测器
 * 检测 JSON 字符串中的各种语法错误
 */

export interface JsonError {
  type: ErrorType
  message: string
  line: number
  column: number
  position: number
  severity: 'error' | 'warning'
  suggestion: string
}

export type ErrorType = 
  | 'missing_bracket'
  | 'missing_brace'
  | 'missing_quote'
  | 'missing_comma'
  | 'missing_colon'
  | 'trailing_comma'
  | 'extra_comma'
  | 'invalid_value'
  | 'unterminated_string'
  | 'invalid_escape'
  | 'unexpected_token'
  | 'duplicate_key'

export interface BracketInfo {
  char: string
  position: number
  line: number
  column: number
  isOpening: boolean
  pair: string
}

/**
 * 检测 JSON 错误
 */
export function detectErrors(jsonString: string): JsonError[] {
  const errors: JsonError[] = []
  
  // 检测括号匹配
  errors.push(...detectBracketMismatches(jsonString))
  
  // 检测引号问题
  errors.push(...detectQuoteIssues(jsonString))
  
  // 检测逗号问题
  errors.push(...detectCommaIssues(jsonString))
  
  // 检测值格式问题
  errors.push(...detectValueIssues(jsonString))
  
  // 检测键值对格式
  errors.push(...detectKeyValueIssues(jsonString))
  
  // 尝试使用原生 JSON.parse 捕获其他错误
  errors.push(...detectWithNativeParse(jsonString))
  
  // 按位置排序并去重
  return removeDuplicateErrors(errors.sort((a, b) => a.position - b.position))
}

/**
 * 检测括号匹配问题
 */
function detectBracketMismatches(jsonString: string): JsonError[] {
  const errors: JsonError[] = []
  const stack: BracketInfo[] = []
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' }
  
  let line = 1
  let column = 1
  let inString = false
  let escapeNext = false
  
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i]
    
    // 更新行号列号
    if (char === '\n') {
      line++
      column = 1
      continue
    }
    column++
    
    // 处理字符串
    if (char === '"' && !escapeNext) {
      inString = !inString
    }
    
    // 处理转义
    if (char === '\\' && inString) {
      escapeNext = !escapeNext
    } else {
      escapeNext = false
    }
    
    // 只在非字符串内检测括号
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push({
          char,
          position: i,
          line,
          column,
          isOpening: true,
          pair: pairs[char]
        })
      } else if (char === '}' || char === ']') {
        const expectedPair = char === '}' ? '{' : '['
        const lastBracket = stack.pop()
        
        if (!lastBracket) {
          errors.push({
            type: char === '}' ? 'missing_brace' : 'missing_bracket',
            message: `多余的闭合括号 '${char}'`,
            line,
            column,
            position: i,
            severity: 'error',
            suggestion: `删除此处的 '${char}' 或在前面添加对应的 '${expectedPair}'`
          })
        } else if (lastBracket.char !== expectedPair) {
          errors.push({
            type: 'missing_bracket',
            message: `括号类型不匹配: 期望 '${lastBracket.pair}' 但找到 '${char}'`,
            line,
            column,
            position: i,
            severity: 'error',
            suggestion: `将此处的 '${char}' 改为 '${lastBracket.pair}' 或检查前面的 '${lastBracket.char}' 是否正确`
          })
        }
      }
    }
  }
  
  // 检查未闭合的括号
  for (const bracket of stack) {
    errors.push({
      type: bracket.char === '{' ? 'missing_brace' : 'missing_bracket',
      message: `未闭合的 '${bracket.char}'`,
      line: bracket.line,
      column: bracket.column,
      position: bracket.position,
      severity: 'error',
      suggestion: `在适当位置添加闭合符号 '${bracket.pair}'`
    })
  }
  
  return errors
}

/**
 * 检测引号问题
 */
function detectQuoteIssues(jsonString: string): JsonError[] {
  const errors: JsonError[] = []
  let line = 1
  let column = 1
  let inString = false
  let escapeNext = false
  let stringStartLine = 1
  let stringStartColumn = 1
  let stringStartPos = 0
  
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i]
    
    if (char === '\n') {
      if (!inString) {
        line++
        column = 1
      }
      continue
    }
    column++
    
    if (char === '"' && !escapeNext) {
      if (!inString) {
        inString = true
        stringStartLine = line
        stringStartColumn = column
        stringStartPos = i
      } else {
        inString = false
      }
    }
    
    if (char === '\\' && inString) {
      escapeNext = !escapeNext
    } else {
      escapeNext = false
    }
  }
  
  // 检测未闭合的字符串
  if (inString) {
    errors.push({
      type: 'unterminated_string',
      message: '未闭合的字符串',
      line: stringStartLine,
      column: stringStartColumn,
      position: stringStartPos,
      severity: 'error',
      suggestion: '在字符串末尾添加闭合引号 "'
    })
  }
  
  // 检测单引号使用
  const singleQuoteRegex = /'[^']*'/g
  let match
  while ((match = singleQuoteRegex.exec(jsonString)) !== null) {
    const pos = getLineColumn(jsonString, match.index)
    errors.push({
      type: 'missing_quote',
      message: 'JSON 标准应使用双引号而非单引号',
      line: pos.line,
      column: pos.column,
      position: match.index,
      severity: 'error',
      suggestion: '将单引号替换为双引号'
    })
  }
  
  return errors
}

/**
 * 检测逗号问题
 */
function detectCommaIssues(jsonString: string): JsonError[] {
  const errors: JsonError[] = []
  
  // 检测尾随逗号 (trailing comma)
  const trailingCommaRegex = /,(\s*[}\]])/g
  let match
  while ((match = trailingCommaRegex.exec(jsonString)) !== null) {
    const pos = getLineColumn(jsonString, match.index)
    errors.push({
      type: 'trailing_comma',
      message: '多余的尾随逗号',
      line: pos.line,
      column: pos.column,
      position: match.index,
      severity: 'warning',
      suggestion: '删除此逗号'
    })
  }
  
  // 检测连续逗号
  const doubleCommaRegex = /,,/g
  while ((match = doubleCommaRegex.exec(jsonString)) !== null) {
    const pos = getLineColumn(jsonString, match.index)
    errors.push({
      type: 'extra_comma',
      message: '多余的逗号',
      line: pos.line,
      column: pos.column,
      position: match.index,
      severity: 'error',
      suggestion: '删除多余的逗号'
    })
  }
  
  return errors
}

/**
 * 检测值格式问题
 */
function detectValueIssues(jsonString: string): JsonError[] {
  const errors: JsonError[] = []
  
  // 检测常见的无效值
  const invalidValuePatterns = [
    { regex: /:\s*undefined/g, value: 'undefined' },
    { regex: /:\s*NaN/g, value: 'NaN' },
    { regex: /:\s*Infinity/g, value: 'Infinity' },
    { regex: /:\s*-Infinity/g, value: '-Infinity' },
  ]
  
  for (const pattern of invalidValuePatterns) {
    let match
    while ((match = pattern.regex.exec(jsonString)) !== null) {
      const pos = getLineColumn(jsonString, match.index)
      errors.push({
        type: 'invalid_value',
        message: `无效的值: ${pattern.value} 不是有效的 JSON 值`,
        line: pos.line,
        column: pos.column,
        position: match.index,
        severity: 'error',
        suggestion: `将 ${pattern.value} 替换为 null 或其他有效值`
      })
    }
  }
  
  return errors
}

/**
 * 检测键值对格式问题
 */
function detectKeyValueIssues(jsonString: string): JsonError[] {
  const errors: JsonError[] = []
  
  // 使用状态机来追踪上下文（对象 vs 数组）
  // 只有在对象上下文中，字符串后面才应该有冒号
  const contextStack: ('object' | 'array')[] = []
  let inString = false
  let escapeNext = false
  let stringStart = -1
  
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i]
    
    // 处理转义
    if (char === '\\' && inString) {
      escapeNext = !escapeNext
      continue
    }
    
    // 处理字符串边界
    if (char === '"' && !escapeNext) {
      if (!inString) {
        inString = true
        stringStart = i
      } else {
        // 字符串结束
        inString = false
        const stringEnd = i
        
        // 查找字符串后面跟着什么
        let j = stringEnd + 1
        while (j < jsonString.length && /\s/.test(jsonString[j])) {
          j++
        }
        
        const nextChar = jsonString[j]
        const currentContext = contextStack[contextStack.length - 1]
        
        // 只有在对象上下文中，字符串后面才需要冒号
        if (currentContext === 'object' && nextChar !== ':') {
          // 检查是否是最后一个元素（后面直接跟 }）
          if (nextChar !== '}' && nextChar !== ',') {
            const keyMatch = jsonString.substring(stringStart, stringEnd + 1)
            const pos = getLineColumn(jsonString, stringStart)
            errors.push({
              type: 'missing_colon',
              message: `缺少冒号: 键 ${keyMatch} 后应有冒号`,
              line: pos.line,
              column: pos.column + keyMatch.length,
              position: stringStart,
              severity: 'error',
              suggestion: `在 ${keyMatch} 后添加冒号和值`
            })
          }
        }
      }
    }
    
    escapeNext = false
    
    // 只在字符串外处理括号
    if (!inString) {
      if (char === '{') {
        contextStack.push('object')
      } else if (char === '[') {
        contextStack.push('array')
      } else if (char === '}' || char === ']') {
        contextStack.pop()
      }
    }
  }
  
  return errors
}

/**
 * 使用原生 JSON.parse 捕获错误
 */
function detectWithNativeParse(jsonString: string): JsonError[] {
  const errors: JsonError[] = []
  
  try {
    JSON.parse(jsonString)
  } catch (e) {
    if (e instanceof SyntaxError) {
      // 解析错误信息提取位置
      const match = e.message.match(/position\s+(\d+)/i)
      const position = match ? parseInt(match[1]) : 0
      const pos = getLineColumn(jsonString, position)
      
      errors.push({
        type: 'unexpected_token',
        message: `语法错误: ${e.message}`,
        line: pos.line,
        column: pos.column,
        position,
        severity: 'error',
        suggestion: getSuggestionForParseError(e.message, jsonString, position)
      })
    }
  }
  
  return errors
}

/**
 * 根据解析错误获取建议
 */
function getSuggestionForParseError(message: string, jsonString: string, position: number): string {
  if (message.includes('Unexpected token')) {
    const nearChar = jsonString[position] || ''
    if (nearChar === "'") {
      return 'JSON 标准要求使用双引号，请将单引号替换为双引号'
    }
    if (nearChar === ',') {
      return '检查逗号位置是否正确，可能需要删除多余的逗号'
    }
    if (nearChar === '}' || nearChar === ']') {
      return '检查括号前是否有多余的内容'
    }
    return '检查此处的语法是否正确'
  }
  
  if (message.includes('Unexpected end')) {
    return 'JSON 不完整，可能缺少闭合的括号或引号'
  }
  
  return '请检查 JSON 语法'
}

/**
 * 获取字符位置的行号和列号
 */
function getLineColumn(text: string, position: number): { line: number; column: number } {
  const lines = text.substring(0, position).split('\n')
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  }
}

/**
 * 去除重复错误
 */
function removeDuplicateErrors(errors: JsonError[]): JsonError[] {
  const seen = new Set<string>()
  return errors.filter(error => {
    const key = `${error.type}-${error.position}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

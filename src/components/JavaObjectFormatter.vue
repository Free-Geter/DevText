<script setup lang="ts">
import { ref, computed } from 'vue'
import JsonValue from './JsonValue.vue'

const inputText = ref('')
const errorMessage = ref('')
const expandedCount = ref(0)
const parsedData = ref<unknown>(null)

const mode = ref<'formatted' | 'compressed'>('formatted')
const copySuccess = ref(false)

// 折叠/展开信号量
const expandAllTrigger = ref(0)
const collapseAllTrigger = ref(0)

const expandAll = () => { expandAllTrigger.value++ }
const collapseAll = () => { collapseAllTrigger.value++ }

function deepParseJson(obj: unknown, counter: { count: number }): unknown {
  if (typeof obj === 'string') {
    const trimmed = obj.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed === 'object' && parsed !== null) {
          counter.count++
          return deepParseJson(parsed, counter)
        }
        return parsed
      } catch {
        return obj
      }
    }
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepParseJson(item, counter))
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepParseJson(value, counter)
    }
    return result
  }
  return obj
}

function handleFormat() {
  const text = inputText.value.trim()
  if (!text) {
    parsedData.value = null
    errorMessage.value = ''
    expandedCount.value = 0
    return
  }

  try {
    const parsed = JSON.parse(text)
    const counter = { count: 0 }
    const expanded = deepParseJson(parsed, counter)
    expandedCount.value = counter.count
    parsedData.value = expanded
    errorMessage.value = ''
  } catch (e) {
    errorMessage.value = `JSON 解析失败: ${(e as Error).message}`
    parsedData.value = null
    expandedCount.value = 0
  }
}

function handleClear() {
  inputText.value = ''
  parsedData.value = null
  errorMessage.value = ''
  expandedCount.value = 0
}

async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText()
    inputText.value = text
    handleFormat()
  } catch {
    // Ignore paste errors
  }
}

const formattedOutput = computed(() => {
  if (parsedData.value === null || parsedData.value === undefined) return ''
  try {
    return JSON.stringify(parsedData.value, null, 2)
  } catch {
    return ''
  }
})

const compressedOutput = computed(() => {
  if (parsedData.value === null || parsedData.value === undefined) return ''
  try {
    return JSON.stringify(parsedData.value)
  } catch {
    return ''
  }
})

const hasOutput = computed(() => parsedData.value !== null && parsedData.value !== undefined)

const displayText = computed(() => {
  return mode.value === 'formatted' ? formattedOutput.value : compressedOutput.value
})

const outputLineCount = computed(() => {
  if (!hasOutput.value) return 0
  return formattedOutput.value.split('\n').length
})

async function handleCopy() {
  if (!hasOutput.value) return
  try {
    await navigator.clipboard.writeText(displayText.value)
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
  } catch {
    // Ignore copy errors
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 flex-1">
    <!-- 输入区域 -->
    <div class="editor-area flex flex-col flex-1 min-h-[200px]">
      <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span class="text-sm font-medium text-muted-foreground">输入 Java 对象 JSON 字符串</span>
        <div class="flex gap-2">
          <button
            @click="handlePaste"
            class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
          >
            粘贴
          </button>
          <button
            @click="handleClear"
            class="text-xs px-2 py-1 rounded bg-secondary hover:bg-destructive/20 transition-colors"
          >
            清空
          </button>
        </div>
      </div>
      <textarea
        v-model="inputText"
        class="editor-textarea flex-1 min-h-[160px]"
        placeholder="在此粘贴 Java 对象 toString() 输出的 JSON 字符串...&#10;&#10;例如: {&quot;limitValue&quot;:&quot;[{\\\&quot;beginTime\\\&quot;:\\\&quot;00:00\\\&quot;}]&quot;}"
        spellcheck="false"
      ></textarea>
    </div>

    <!-- 主操作按钮栏 -->
    <div class="flex items-center gap-3 flex-wrap">
      <button
        @click="handleFormat"
        class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
      >
        格式化 & 展开
      </button>

      <!-- 统计信息 -->
      <div v-if="hasOutput" class="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
        <span v-if="expandedCount > 0" class="text-primary font-medium">
          展开了 {{ expandedCount }} 个嵌套 JSON
        </span>
        <span>{{ outputLineCount }} 行</span>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
      {{ errorMessage }}
    </div>

    <!-- 输出区域 -->
    <div v-if="hasOutput" class="editor-area flex flex-col flex-1 min-h-[200px]">
      <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span class="text-sm font-medium text-muted-foreground">
          格式化输出（嵌套 JSON 已展开）
        </span>
        <div class="flex gap-2 flex-wrap">
          <button
            @click="expandAll"
            class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
            title="展开所有"
          >
            展开全部
          </button>
          <button
            @click="collapseAll"
            class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
            title="收起所有"
          >
            收起全部
          </button>
          <button
            @click="mode = 'formatted'"
            :class="[
              'text-xs px-2 py-1 rounded transition-colors',
              mode === 'formatted' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            ]"
          >
            格式化
          </button>
          <button
            @click="mode = 'compressed'"
            :class="[
              'text-xs px-2 py-1 rounded transition-colors',
              mode === 'compressed' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            ]"
          >
            压缩
          </button>
          <button
            @click="handleCopy"
            :class="[
              'text-xs px-2 py-1 rounded transition-colors',
              copySuccess ? 'bg-success text-success-foreground' : 'bg-secondary hover:bg-secondary/80'
            ]"
          >
            {{ copySuccess ? '已复制' : '复制' }}
          </button>
        </div>
      </div>

      <!-- 格式化模式：可折叠树形 -->
      <div v-if="mode === 'formatted'" class="flex-1 overflow-auto p-4">
        <div v-if="parsedData !== null && parsedData !== undefined" class="json-output">
          <JsonValue
            :data="parsedData"
            :expand-all-signal="expandAllTrigger"
            :collapse-all-signal="collapseAllTrigger"
          />
        </div>
      </div>

      <!-- 压缩模式：纯文本 -->
      <div v-else class="flex-1 overflow-auto p-4">
        <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ compressedOutput }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.json-output {
  font-family: Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}
</style>

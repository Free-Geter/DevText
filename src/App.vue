<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import JsonInput from './components/JsonInput.vue'
import JsonOutput from './components/JsonOutput.vue'
import ErrorPanel from './components/ErrorPanel.vue'
import TextDiff from './components/TextDiff.vue'
import JavaObjectFormatter from './components/JavaObjectFormatter.vue'
import TimestampTool from './components/TimestampTool.vue'
import { parseJson, type ParseResult } from './lib/json-parser'

const activeTab = ref<'json' | 'diff' | 'java' | 'timestamp'>('json')

const inputJson = ref('')
const parseResult = ref<ParseResult>({
  success: false,
  data: null,
  formattedJson: '',
  compressedJson: '',
  errors: [],
  escapeSequences: []
})

// 自动解析输入
watch(inputJson, (newValue) => {
  if (newValue.trim()) {
    parseResult.value = parseJson(newValue)
  } else {
    parseResult.value = {
      success: false,
      data: null,
      formattedJson: '',
      compressedJson: '',
      errors: [],
      escapeSequences: []
    }
  }
}, { immediate: true })

const errorCount = computed(() => parseResult.value.errors.length)
const warningCount = computed(() => 
  parseResult.value.errors.filter(e => e.severity === 'warning').length
)
const realErrorCount = computed(() => 
  parseResult.value.errors.filter(e => e.severity === 'error').length
)

const jsonInputRef = ref<InstanceType<typeof JsonInput> | null>(null)

const handleFormat = () => {
  // 触发重新解析
  if (inputJson.value.trim()) {
    parseResult.value = parseJson(inputJson.value)
  }
}

const handlePaste = () => {
  jsonInputRef.value?.paste()
}

// 处理输出栏的编辑：将编辑内容同步回输入框
const handleOutputEdit = (editedText: string) => {
  inputJson.value = editedText
}

// 示例 JSON
const loadExample = () => {
  inputJson.value = `{
  "name": "JSON 格式化工具",
  "version": "1.0.0",
  "features": [
    "语法错误检测",
    "自动修复建议",
    "转义字符处理",
    "格式化输出"
  ],
  "config": {
    "indent": 2,
    "strict": false
  }
}`
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <!-- 头部 -->
    <header class="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold">DevText 工具箱</h1>
              <p class="text-sm text-muted-foreground">JSON 格式化 · 错误修复 · 文本差异对比</p>
            </div>
          </div>
          <div v-if="activeTab === 'json'" class="flex items-center gap-2">
            <button 
              @click="loadExample"
              class="px-4 py-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              加载示例
            </button>
            <button 
              @click="handlePaste"
              class="px-4 py-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              粘贴
            </button>
            <button 
              @click="handleFormat"
              class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
            >
              格式化
            </button>
          </div>
        </div>
      </div>
      <!-- Tab 导航 -->
      <div class="container mx-auto px-4">
        <nav class="flex gap-1 -mb-px">
          <button
            @click="activeTab = 'json'"
            class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2"
            :class="activeTab === 'json'
              ? 'border-primary text-primary bg-primary/10'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          >
            JSON 格式化
          </button>
          <button
            @click="activeTab = 'diff'"
            class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2"
            :class="activeTab === 'diff'
              ? 'border-primary text-primary bg-primary/10'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          >
            文本对比
          </button>
          <button
            @click="activeTab = 'java'"
            class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2"
            :class="activeTab === 'java'
              ? 'border-primary text-primary bg-primary/10'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          >
            Java对象格式化
          </button>
          <button
            @click="activeTab = 'timestamp'"
            class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2"
            :class="activeTab === 'timestamp'
              ? 'border-primary text-primary bg-primary/10'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'"
          >
            时间戳
          </button>
        </nav>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="flex-1 container mx-auto px-4 py-6 flex flex-col gap-6">
      <!-- JSON 格式化区域 -->
      <div v-show="activeTab === 'json'" class="flex flex-col gap-6 flex-1">
        <!-- 编辑器区域 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
          <JsonInput ref="jsonInputRef" v-model="inputJson" />
          <JsonOutput
            :formatted-json="parseResult.formattedJson"
            :compressed-json="parseResult.compressedJson"
            :success="parseResult.success"
            @update:formatted-json="handleOutputEdit"
          />
        </div>

        <!-- 错误面板 -->
        <ErrorPanel 
          :errors="parseResult.errors"
          :escape-sequences="parseResult.escapeSequences"
        />

        <!-- 统计信息 -->
        <div v-if="inputJson.trim()" class="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div class="flex items-center gap-2">
            <span>字符数:</span>
            <span class="font-mono">{{ inputJson.length }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span>行数:</span>
            <span class="font-mono">{{ inputJson.split('\n').length }}</span>
          </div>
          <div v-if="errorCount > 0" class="flex items-center gap-2">
            <span>问题:</span>
            <span class="font-mono text-destructive">{{ realErrorCount }} 个错误</span>
            <span v-if="warningCount > 0" class="font-mono text-warning">{{ warningCount }} 个警告</span>
          </div>
          <div v-if="parseResult.escapeSequences.length > 0" class="flex items-center gap-2">
            <span>转义字符:</span>
            <span class="font-mono text-primary">{{ parseResult.escapeSequences.length }} 种</span>
          </div>
        </div>
      </div>

      <!-- 文本对比区域 -->
      <div v-show="activeTab === 'diff'" class="flex flex-col flex-1">
        <TextDiff />
      </div>

      <!-- Java对象格式化区域 -->
      <div v-show="activeTab === 'java'" class="flex flex-col flex-1">
        <JavaObjectFormatter />
      </div>

      <!-- 时间戳工具区域 -->
      <div v-show="activeTab === 'timestamp'" class="flex flex-col flex-1">
        <TimestampTool />
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="border-t border-border py-4 text-center text-sm text-muted-foreground">
      <p>支持拖拽文件 · 自动错误检测 · 一键格式化</p>
    </footer>
  </div>
</template>

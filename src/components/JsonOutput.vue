<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import JsonValue from './JsonValue.vue'
import { highlightJson } from '../lib/json-highlighter'

const props = defineProps<{
  formattedJson: string
  compressedJson: string
  success: boolean
}>()

const emit = defineEmits<{
  (e: 'update:formattedJson', value: string): void
}>()

const mode = ref<'formatted' | 'compressed'>('formatted')
const copied = ref(false)
const showModal = ref(false)

// 编辑模式
const isEditing = ref(false)
const editText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const preRef = ref<HTMLPreElement | null>(null)
const fromEmit = ref(false)

const editValid = computed(() => {
  if (!editText.value.trim()) return true
  try {
    JSON.parse(editText.value)
    return true
  } catch {
    return false
  }
})

const editTextareaLineNumbers = computed(() => {
  const lines = editText.value.split('\n')
  return lines.map((_, i) => i + 1)
})

const toggleEdit = () => {
  if (!isEditing.value) {
    // 进入编辑模式：用当前格式化结果填充 textarea
    editText.value = props.formattedJson
    mode.value = 'formatted'
    isEditing.value = true
    nextTick(() => textareaRef.value?.focus())
  } else {
    // 退出编辑模式：将编辑内容同步回去
    isEditing.value = false
    if (editText.value !== props.formattedJson) {
      fromEmit.value = true
      emit('update:formattedJson', editText.value)
    }
  }
}

// 当 formattedJson 外部变化时（如输入变化、加载示例），同步到 editText
// 但跳过由本组件 emit 触发的变化，避免覆盖用户正在编辑的内容
watch(() => props.formattedJson, (newVal) => {
  if (!isEditing.value) {
    editText.value = newVal
  } else if (!fromEmit.value) {
    editText.value = newVal
  }
  fromEmit.value = false
})

const handleEditInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  editText.value = target.value
  fromEmit.value = true
  emit('update:formattedJson', target.value)
}

const syncScroll = () => {
  if (textareaRef.value && preRef.value) {
    preRef.value.scrollTop = textareaRef.value.scrollTop
    preRef.value.scrollLeft = textareaRef.value.scrollLeft
  }
}

const handleEditKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter') return
  const target = event.target as HTMLTextAreaElement
  const { selectionStart, selectionEnd, value } = target

  // 取当前行，提取行首空白字符
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const currentLine = value.substring(lineStart, selectionStart)
  const indentMatch = currentLine.match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1] : ''

  // 光标前一个字符是 { 或 [ 时额外多缩进 2 空格
  const prevChar = value[selectionStart - 1]
  const extraIndent = prevChar === '{' || prevChar === '[' ? '  ' : ''

  event.preventDefault()
  const insertion = '\n' + indent + extraIndent
  const before = value.substring(0, selectionStart)
  const after = value.substring(selectionEnd)
  const newValue = before + insertion + after

  editText.value = newValue
  fromEmit.value = true
  emit('update:formattedJson', newValue)

  nextTick(() => {
    const newPos = selectionStart + insertion.length
    target.selectionStart = newPos
    target.selectionEnd = newPos
    target.scrollTop = target.scrollTop
  })
}

const editHighlightedHtml = computed(() => highlightJson(editText.value))

// 主区域展开/收起控制
const expandAllTrigger = ref(0)
const collapseAllTrigger = ref(0)

const parsedData = computed(() => {
  if (!props.formattedJson) return null
  try {
    return JSON.parse(props.formattedJson)
  } catch {
    return null
  }
})

const displayJson = computed(() => {
  return mode.value === 'formatted' ? props.formattedJson : props.compressedJson
})

const copyToClipboard = async () => {
  try {
    const text = isEditing.value ? editText.value : displayJson.value
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Ignore copy errors
  }
}

const expandAll = () => {
  expandAllTrigger.value++
}

const collapseAll = () => {
  collapseAllTrigger.value++
}

const openModal = () => {
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

// 弹窗内的展开/收起控制
const modalExpandTrigger = ref(0)
const modalCollapseTrigger = ref(0)

const modalExpandAll = () => {
  modalExpandTrigger.value++
}

const modalCollapseAll = () => {
  modalCollapseTrigger.value++
}
</script>

<template>
  <div class="editor-area h-full flex flex-col">
    <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-muted-foreground">
          输出
          <span
            v-if="success"
            class="ml-2 text-xs px-2 py-0.5 rounded bg-success/20 text-success"
          >
            有效 JSON
          </span>
          <span
            v-else-if="formattedJson"
            class="ml-2 text-xs px-2 py-0.5 rounded bg-warning/20 text-warning"
          >
            有错误
          </span>
        </span>
        <!-- 编辑开关 -->
        <button
          type="button"
          @click="toggleEdit"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors"
          :class="isEditing
            ? 'bg-primary/15 border-primary/60 text-primary'
            : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          {{ isEditing ? '退出编辑' : '编辑' }}
        </button>
        <!-- 编辑模式下的有效性指示 -->
        <span
          v-if="isEditing && editText.trim()"
          class="text-xs px-2 py-0.5 rounded"
          :class="editValid
            ? 'bg-success/20 text-success'
            : 'bg-destructive/20 text-destructive'"
        >
          {{ editValid ? 'JSON 有效' : 'JSON 无效' }}
        </span>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button
          v-if="!isEditing"
          @click="expandAll"
          class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
          title="展开所有"
        >
          展开全部
        </button>
        <button
          v-if="!isEditing"
          @click="collapseAll"
          class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
          title="收起所有"
        >
          收起全部
        </button>
        <button
          v-if="!isEditing"
          @click="openModal"
          class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
          title="大窗口查看"
        >
          ⛶ 放大
        </button>
        <button
          v-if="!isEditing"
          @click="mode = 'formatted'"
          :class="[
            'text-xs px-2 py-1 rounded transition-colors',
            mode === 'formatted' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
          ]"
        >
          格式化
        </button>
        <button
          v-if="!isEditing"
          @click="mode = 'compressed'"
          :class="[
            'text-xs px-2 py-1 rounded transition-colors',
            mode === 'compressed' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
          ]"
        >
          压缩
        </button>
        <button
          @click="copyToClipboard"
          :class="[
            'text-xs px-2 py-1 rounded transition-colors',
            copied ? 'bg-success text-success-foreground' : 'bg-secondary hover:bg-secondary/80'
          ]"
        >
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
    </div>
    
    <!-- 编辑模式：高亮背景层 + 透明文本框叠加 -->
    <div v-if="isEditing" class="flex flex-1 overflow-hidden">
      <div class="edit-line-numbers py-4 pl-4 bg-muted/20 select-none overflow-hidden">
        <div v-for="num in editTextareaLineNumbers" :key="num" class="leading-relaxed">
          {{ num }}
        </div>
      </div>
      <div class="edit-overlay-wrap flex-1 relative" :class="editValid ? 'edit-valid' : 'edit-invalid'">
        <pre
          ref="preRef"
          class="edit-highlight-layer"
          v-html="editHighlightedHtml"
        ></pre>
        <textarea
          ref="textareaRef"
          :value="editText"
          @input="handleEditInput"
          @keydown="handleEditKeydown"
          @scroll="syncScroll"
          class="edit-textarea-layer"
          spellcheck="false"
          placeholder="在此编辑 JSON..."
        ></textarea>
      </div>
    </div>

    <!-- 格式化输出（可折叠） -->
    <div v-else-if="mode === 'formatted'" class="flex-1 overflow-auto p-4">
      <div v-if="parsedData" class="json-output">
        <JsonValue 
          :data="parsedData" 
          :expand-all-signal="expandAllTrigger"
          :collapse-all-signal="collapseAllTrigger"
        />
      </div>
      <div v-else-if="displayJson" class="text-muted-foreground text-sm">
        {{ displayJson }}
      </div>
      <div v-else class="text-muted-foreground text-sm">
        格式化结果将显示在这里
      </div>
    </div>
    
    <!-- 压缩输出 -->
    <div v-else-if="mode === 'compressed'" class="flex-1 overflow-auto p-4">
      <pre v-if="displayJson" class="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{{ displayJson }}</pre>
      <div v-else class="text-muted-foreground text-sm">
        格式化结果将显示在这里
      </div>
    </div>
  </div>

  <!-- 大弹窗 -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="text-lg font-semibold">JSON 格式化结果</h3>
            <div class="flex gap-2">
              <button 
                @click="modalExpandAll"
                class="text-xs px-3 py-1.5 rounded bg-secondary hover:bg-secondary/80 transition-colors"
              >
                展开全部
              </button>
              <button 
                @click="modalCollapseAll"
                class="text-xs px-3 py-1.5 rounded bg-secondary hover:bg-secondary/80 transition-colors"
              >
                收起全部
              </button>
              <button 
                @click="copyToClipboard"
                :class="[
                  'text-xs px-3 py-1.5 rounded transition-colors',
                  copied ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'
                ]"
              >
                {{ copied ? '已复制' : '复制' }}
              </button>
              <button 
                @click="closeModal"
                class="text-xs px-3 py-1.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
          <div class="modal-content">
            <div v-if="parsedData" class="json-output">
              <JsonValue 
                :data="parsedData" 
                :expand-all-signal="modalExpandTrigger"
                :collapse-all-signal="modalCollapseTrigger"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.json-output {
  font-family: Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

/* 行号 */
.edit-line-numbers {
  font-family: Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  text-align: right;
  min-width: 2.5rem;
  border-right: 1px solid hsl(var(--border));
}

.edit-line-numbers > div {
  font-size: 0.75rem;
  line-height: 1.6;
}

/* 编辑模式：高亮叠加层 */
.edit-overlay-wrap {
  position: relative;
  overflow: hidden;
}

.edit-highlight-layer,
.edit-textarea-layer {
  font-family: Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  padding: 1rem;
  margin: 0;
  white-space: pre;
  word-wrap: normal;
  overflow-wrap: normal;
  tab-size: 2;
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.edit-highlight-layer {
  pointer-events: none;
  z-index: 1;
  color: hsl(var(--foreground));
}

.edit-textarea-layer {
  z-index: 2;
  background: transparent;
  color: transparent;
  caret-color: hsl(var(--foreground));
  resize: none;
  border: none;
  outline: none;
  -webkit-text-fill-color: transparent;
}

.edit-textarea-layer::placeholder {
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
  -webkit-text-fill-color: initial;
}

.edit-overlay-wrap.edit-valid {
  border-left: 3px solid hsl(var(--success, 142 76% 36%));
}

.edit-overlay-wrap.edit-invalid {
  border-left: 3px solid hsl(var(--destructive, 0 84% 60%));
}

/* JSON 语法着色 */
.edit-highlight-layer :deep(.hl-key)     { color: #7dd3fc; }
.edit-highlight-layer :deep(.hl-string)  { color: #86efac; }
.edit-highlight-layer :deep(.hl-number)  { color: #fcd34d; }
.edit-highlight-layer :deep(.hl-boolean) { color: #c4b5fd; }
.edit-highlight-layer :deep(.hl-null)    { color: #fca5a5; }
.edit-highlight-layer :deep(.hl-bracket) { color: #94a3b8; }
.edit-highlight-layer :deep(.hl-colon)   { color: #94a3b8; }
.edit-highlight-layer :deep(.hl-comma)   { color: #94a3b8; }
.edit-highlight-layer :deep(.hl-error)   { color: #f87171; text-decoration: underline wavy #f87171; }

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 2rem;
}

.modal-container {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  width: 100%;
  max-width: 1200px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}

.modal-content {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>

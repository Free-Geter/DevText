<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  data: unknown
  depth?: number
  propKey?: string
  collapseAllSignal?: number
  expandAllSignal?: number
  isLast?: boolean
}>()

const depth = computed(() => props.depth ?? 0)
const isLast = computed(() => props.isLast ?? false)

// 折叠状态
const collapsed = ref(false)

// 监听全局展开信号
watch(() => props.expandAllSignal, () => {
  collapsed.value = false
})

// 监听全局收起信号（只收起非根节点）
watch(() => props.collapseAllSignal, () => {
  if (depth.value > 0) {
    collapsed.value = true
  }
})

const isObject = computed(() => {
  return typeof props.data === 'object' && props.data !== null
})

const isArray = computed(() => {
  return Array.isArray(props.data)
})

const entries = computed(() => {
  if (isArray.value) {
    return (props.data as unknown[]).map((v, i) => [i, v] as [number, unknown])
  }
  if (isObject.value) {
    return Object.entries(props.data as Record<string, unknown>)
  }
  return []
})

const isEmpty = computed(() => {
  return entries.value.length === 0
})

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
}

const getValueType = (value: unknown): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return `"${value}"`
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

const getPreviewText = (): string => {
  if (isArray.value) {
    return `${entries.value.length} items`
  }
  return `${entries.value.length} keys`
}

const indent = computed(() => '  '.repeat(depth.value))
</script>

<template>
  <div class="json-value-line">
    <!-- 原始值：string, number, boolean, null -->
    <template v-if="!isObject">
      <span class="json-indent">{{ indent }}</span>
      <span v-if="propKey !== undefined" class="json-key">"{{ propKey }}"</span>
      <span v-if="propKey !== undefined">: </span>
      <span v-else-if="isArray && propKey === undefined && depth === 0"></span>
      <span :class="['json-' + getValueType(data)]">{{ formatValue(data) }}</span>
      <span v-if="!isLast" class="json-comma">,</span>
    </template>

    <!-- 对象或数组 -->
    <template v-else>
      <span class="json-indent">{{ indent }}</span>
      <span v-if="propKey !== undefined" class="json-key">"{{ propKey }}"</span>
      <span v-if="propKey !== undefined">: </span>
      
      <!-- 折叠图标 -->
      <button 
        v-if="!isEmpty"
        @click="toggleCollapse"
        class="collapse-btn"
        :title="collapsed ? '展开' : '收起'"
      >
        <svg 
          class="collapse-icon" 
          :class="{ 'collapsed': collapsed }"
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <!-- 开始括号 -->
      <span class="json-bracket">{{ isArray ? '[' : '{' }}</span>

      <!-- 空对象/数组 -->
      <template v-if="isEmpty">
        <span class="json-bracket">{{ isArray ? ']' : '}' }}</span>
        <span v-if="!isLast" class="json-comma">,</span>
      </template>

      <!-- 折叠预览 -->
      <template v-else-if="collapsed">
        <span class="collapsed-preview">...</span>
        <span class="json-bracket">{{ isArray ? ']' : '}' }}</span>
        <span class="preview-comment">// {{ getPreviewText() }}</span>
        <span v-if="!isLast" class="json-comma">,</span>
      </template>

      <!-- 展开内容 -->
      <template v-else>
        <span></span>
        <div class="json-content">
          <template 
            v-for="([key, value], index) in entries" 
            :key="key"
          >
            <JsonValue 
              v-if="isArray"
              :data="value" 
              :depth="depth + 1"
              :is-last="index === entries.length - 1"
              :collapse-all-signal="collapseAllSignal"
              :expand-all-signal="expandAllSignal"
            />
            <JsonValue 
              v-else
              :data="value" 
              :depth="depth + 1"
              :prop-key="String(key)"
              :is-last="index === entries.length - 1"
              :collapse-all-signal="collapseAllSignal"
              :expand-all-signal="expandAllSignal"
            />
          </template>
          <div class="json-line">
            <span class="json-indent">{{ indent }}</span>
            <span class="json-bracket">{{ isArray ? ']' : '}' }}</span>
            <span v-if="!isLast" class="json-comma">,</span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.json-value-line {
  font-family: Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre;
}

.collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 2px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s, background 0.15s;
  vertical-align: middle;
  border-radius: 4px;
}

.collapse-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.collapse-icon {
  width: 12px;
  height: 12px;
  color: var(--foreground);
  transition: transform 0.2s ease;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.json-key {
  color: #7dd3fc;
}

.json-string {
  color: #86efac;
}

.json-number {
  color: #fcd34d;
}

.json-boolean {
  color: #c4b5fd;
}

.json-null {
  color: #fca5a5;
}

.json-bracket {
  color: #94a3b8;
}

.json-comma {
  color: #94a3b8;
}

.json-content {
  display: flex;
  flex-direction: column;
}

.json-line {
  white-space: pre;
}

.json-indent {
  color: transparent;
}

.collapsed-preview {
  font-style: italic;
  opacity: 0.6;
}

.preview-comment {
  margin-left: 0.5rem;
  font-style: italic;
  opacity: 0.4;
  font-size: 0.75rem;
}
</style>

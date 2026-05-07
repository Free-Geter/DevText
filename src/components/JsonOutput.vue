<script setup lang="ts">
import { ref, computed } from 'vue'
import JsonValue from './JsonValue.vue'

const props = defineProps<{
  formattedJson: string
  compressedJson: string
  success: boolean
}>()

const mode = ref<'formatted' | 'compressed'>('formatted')
const copied = ref(false)
const showModal = ref(false)

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
    await navigator.clipboard.writeText(displayJson.value)
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
          @click="openModal"
          class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
          title="大窗口查看"
        >
          ⛶ 放大
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
    
    <!-- 格式化输出（可折叠） -->
    <div v-if="mode === 'formatted'" class="flex-1 overflow-auto p-4">
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
    <div v-else class="flex-1 overflow-auto p-4">
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

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isFocused = ref(false)

const lineNumbers = computed(() => {
  const lines = props.modelValue.split('\n')
  return lines.map((_, i) => i + 1)
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      emit('update:modelValue', content)
    }
    reader.readAsText(file)
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText()
    emit('update:modelValue', text)
  } catch {
    // Ignore paste errors
  }
}

const clearInput = () => {
  emit('update:modelValue', '')
}

defineExpose({
  focus: () => textareaRef.value?.focus(),
  paste: handlePaste
})
</script>

<template>
  <div 
    class="editor-area h-full flex flex-col"
    :class="{ 'ring-2 ring-primary': isFocused }"
    @drop="handleDrop"
    @dragover="handleDragOver"
  >
    <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
      <span class="text-sm font-medium text-muted-foreground">输入 JSON</span>
      <div class="flex gap-2">
        <button 
          @click="handlePaste"
          class="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors"
        >
          粘贴
        </button>
        <button 
          @click="clearInput"
          class="text-xs px-2 py-1 rounded bg-secondary hover:bg-destructive/20 transition-colors"
        >
          清空
        </button>
      </div>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <!-- 行号 -->
      <div class="line-numbers py-4 pl-4 bg-muted/20 select-none overflow-hidden">
        <div v-for="num in lineNumbers" :key="num" class="leading-relaxed">
          {{ num }}
        </div>
      </div>
      <!-- 输入区域 -->
      <textarea
        ref="textareaRef"
        :value="modelValue"
        @input="handleInput"
        @focus="isFocused = true"
        @blur="isFocused = false"
        class="editor-textarea flex-1"
        placeholder="在此粘贴或输入 JSON 字符串...&#10;&#10;支持拖拽文件"
        spellcheck="false"
      ></textarea>
    </div>
  </div>
</template>

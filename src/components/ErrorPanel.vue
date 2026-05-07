<script setup lang="ts">
import type { JsonError } from '@/lib/error-detector'
import type { EscapeSequenceInfo } from '@/lib/json-parser'

defineProps<{
  errors: JsonError[]
  escapeSequences: EscapeSequenceInfo[]
}>()

const getErrorIcon = (severity: 'error' | 'warning') => {
  return severity === 'error' ? '✗' : '⚠'
}

const getErrorClass = (severity: 'error' | 'warning') => {
  return severity === 'error' ? 'text-destructive' : 'text-warning'
}
</script>

<template>
  <div class="bg-card border border-border rounded-lg overflow-hidden">
    <!-- 错误列表 -->
    <div v-if="errors.length > 0" class="border-b border-border">
      <div class="px-4 py-2 bg-muted/30 border-b border-border">
        <span class="text-sm font-medium text-destructive">
          检测到 {{ errors.length }} 个问题
        </span>
      </div>
      <div class="max-h-48 overflow-y-auto">
        <div 
          v-for="(error, index) in errors" 
          :key="index"
          class="px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors"
        >
          <div class="flex items-start gap-2">
            <span :class="['font-bold', getErrorClass(error.severity)]">
              {{ getErrorIcon(error.severity) }}
            </span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ error.message }}</span>
                <span class="text-xs text-muted-foreground">
                  第 {{ error.line }} 行，第 {{ error.column }} 列
                </span>
              </div>
              <div class="mt-1 text-sm text-muted-foreground">
                💡 建议: {{ error.suggestion }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 转义序列信息 -->
    <div v-if="escapeSequences.length > 0">
      <div class="px-4 py-2 bg-muted/30 border-b border-border">
        <span class="text-sm font-medium text-primary">
          已处理的转义字符
        </span>
      </div>
      <div class="p-4 flex flex-wrap gap-2">
        <div 
          v-for="(seq, index) in escapeSequences" 
          :key="index"
          class="px-3 py-1.5 bg-muted/50 rounded-full text-xs font-mono"
        >
          <span class="text-muted-foreground">{{ seq.original }}</span>
          <span class="mx-1">→</span>
          <span class="text-primary">{{ seq.replaced || '(空)' }}</span>
          <span class="ml-1 text-muted-foreground">×{{ seq.count }}</span>
        </div>
      </div>
    </div>
    
    <!-- 无错误状态 -->
    <div v-if="errors.length === 0 && escapeSequences.length === 0" class="p-8 text-center">
      <div class="text-muted-foreground text-sm">
        输入 JSON 后将在此显示错误检测结果
      </div>
    </div>
    
    <!-- 成功状态 -->
    <div v-if="errors.length === 0 && escapeSequences.length > 0" class="px-4 py-3 bg-success/10 border-t border-success/20">
      <div class="flex items-center gap-2 text-success">
        <span>✓</span>
        <span class="text-sm font-medium">JSON 格式正确</span>
      </div>
    </div>
  </div>
</template>

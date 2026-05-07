<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { diffLines, diffChars, diffWords } from 'diff'

type DiffMode = 'side-by-side' | 'inline'
type DiffGranularity = 'char' | 'word'

const originalText = ref('')
const modifiedText = ref('')
const diffMode = ref<DiffMode>('side-by-side')
const diffGranularity = ref<DiffGranularity>('char')
const hasCompared = ref(false)

// Merge undo history
interface MergeSnapshot {
  originalText: string
  modifiedText: string
}

const mergeHistory = ref<MergeSnapshot[]>([])
const maxHistory = 50

const undoMerge = () => {
  if (mergeHistory.value.length === 0) return
  const snapshot = mergeHistory.value.pop()!
  originalText.value = snapshot.originalText
  modifiedText.value = snapshot.modifiedText
}

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    if (mergeHistory.value.length > 0) {
      e.preventDefault()
      undoMerge()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Copy state
const leftCopied = ref(false)
const rightCopied = ref(false)
const inlineCopied = ref(false)

// diffLines result
const lineDiffs = computed(() => {
  if (!hasCompared.value) return []
  return diffLines(originalText.value, modifiedText.value)
})

// Character/word diff result for inline mode
const charDiffs = computed(() => {
  if (!hasCompared.value) return []
  return diffGranularity.value === 'char'
    ? diffChars(originalText.value, modifiedText.value)
    : diffWords(originalText.value, modifiedText.value)
})

// Statistics
const stats = computed(() => {
  let added = 0
  let removed = 0
  for (const part of lineDiffs.value) {
    if (part.added) added += part.count ?? 0
    if (part.removed) removed += part.count ?? 0
  }
  return { added, removed }
})

// Side-by-side lines
interface DiffSegment {
  text: string
  type: 'same' | 'changed'
}

interface SideLine {
  leftNum: number | null
  leftContent: string
  leftType: 'added' | 'removed' | 'unchanged' | 'modified'
  leftSegments?: DiffSegment[]
  rightNum: number | null
  rightContent: string
  rightType: 'added' | 'removed' | 'unchanged' | 'modified'
  rightSegments?: DiffSegment[]
}

// Compute character/word-level segments for a paired line
function computeLineSegments(leftLine: string, rightLine: string): { leftSegs: DiffSegment[]; rightSegs: DiffSegment[] } {
  const parts = diffGranularity.value === 'char'
    ? diffChars(leftLine, rightLine)
    : diffWords(leftLine, rightLine)
  const leftSegs: DiffSegment[] = []
  const rightSegs: DiffSegment[] = []

  for (const part of parts) {
    if (part.added) {
      rightSegs.push({ text: part.value, type: 'changed' })
    } else if (part.removed) {
      leftSegs.push({ text: part.value, type: 'changed' })
    } else {
      leftSegs.push({ text: part.value, type: 'same' })
      rightSegs.push({ text: part.value, type: 'same' })
    }
  }
  return { leftSegs, rightSegs }
}

const sideByLineData = computed((): SideLine[] => {
  if (!hasCompared.value) return []
  // Ensure granularity change triggers recomputation
  void diffGranularity.value
  const result: SideLine[] = []
  let leftNum = 0
  let rightNum = 0

  // Collect diff parts into blocks for pairing
  const parts = lineDiffs.value
  let i = 0

  while (i < parts.length) {
    const part = parts[i]
    const lines = part.value.replace(/\n$/, '').split('\n')
    if (part.value === '' && lines.length === 1 && lines[0] === '') {
      i++
      continue
    }

    if (part.removed) {
      // Check if next part is added (pair them as modifications)
      const nextPart = parts[i + 1]
      if (nextPart && nextPart.added) {
        const removedLines = lines
        const addedLines = nextPart.value.replace(/\n$/, '').split('\n')
        if (nextPart.value === '' && addedLines.length === 1 && addedLines[0] === '') {
          // Next is empty added, treat removed as standalone
          for (const line of removedLines) {
            leftNum++
            result.push({
              leftNum,
              leftContent: line,
              leftType: 'removed',
              rightNum: null,
              rightContent: '',
              rightType: 'unchanged'
            })
          }
          i++
          continue
        }

        // Pair lines: min(removed, added) are paired, rest are standalone
        const pairedCount = Math.min(removedLines.length, addedLines.length)

        for (let j = 0; j < pairedCount; j++) {
          leftNum++
          rightNum++
          const { leftSegs, rightSegs } = computeLineSegments(removedLines[j], addedLines[j])
          result.push({
            leftNum,
            leftContent: removedLines[j],
            leftType: 'modified',
            leftSegments: leftSegs,
            rightNum,
            rightContent: addedLines[j],
            rightType: 'modified',
            rightSegments: rightSegs
          })
        }

        // Remaining removed lines (no pair)
        for (let j = pairedCount; j < removedLines.length; j++) {
          leftNum++
          result.push({
            leftNum,
            leftContent: removedLines[j],
            leftType: 'removed',
            rightNum: null,
            rightContent: '',
            rightType: 'unchanged'
          })
        }

        // Remaining added lines (no pair)
        for (let j = pairedCount; j < addedLines.length; j++) {
          rightNum++
          result.push({
            leftNum: null,
            leftContent: '',
            leftType: 'unchanged',
            rightNum,
            rightContent: addedLines[j],
            rightType: 'added'
          })
        }

        i += 2 // skip the added part
        continue
      }

      // Standalone removed
      for (const line of lines) {
        leftNum++
        result.push({
          leftNum,
          leftContent: line,
          leftType: 'removed',
          rightNum: null,
          rightContent: '',
          rightType: 'unchanged'
        })
      }
    } else if (part.added) {
      // Standalone added (not preceded by removed)
      for (const line of lines) {
        rightNum++
        result.push({
          leftNum: null,
          leftContent: '',
          leftType: 'unchanged',
          rightNum,
          rightContent: line,
          rightType: 'added'
        })
      }
    } else {
      // Unchanged
      for (const line of lines) {
        leftNum++
        rightNum++
        result.push({
          leftNum,
          leftContent: line,
          leftType: 'unchanged',
          rightNum,
          rightContent: line,
          rightType: 'unchanged'
        })
      }
    }
    i++
  }
  return result
})

// Inline merged text for copy
const inlineMergedText = computed(() => {
  if (!hasCompared.value) return ''
  // The merged result = original without removed parts + added parts
  return charDiffs.value
    .filter(p => !p.removed)
    .map(p => p.value)
    .join('')
})

const handleCompare = () => {
  hasCompared.value = true
}

const handleClear = () => {
  originalText.value = ''
  modifiedText.value = ''
  hasCompared.value = false
  mergeHistory.value = []
}

const handleSwap = () => {
  const temp = originalText.value
  originalText.value = modifiedText.value
  modifiedText.value = temp
  if (hasCompared.value) {
    hasCompared.value = true
  }
}

// Merge line functionality
const mergeLine = (index: number, direction: 'to-right' | 'to-left') => {
  const line = sideByLineData.value[index]
  if (!line) return

  // Save snapshot before merge
  mergeHistory.value.push({
    originalText: originalText.value,
    modifiedText: modifiedText.value
  })
  if (mergeHistory.value.length > maxHistory) {
    mergeHistory.value.shift()
  }

  if (direction === 'to-right' && line.leftType === 'removed') {
    // Insert left content into right side at the correct position
    const rightLines = modifiedText.value.split('\n')
    let insertPos = 0
    for (let i = 0; i < index; i++) {
      if (sideByLineData.value[i].rightNum !== null) {
        insertPos = sideByLineData.value[i].rightNum!
      }
    }
    rightLines.splice(insertPos, 0, line.leftContent)
    modifiedText.value = rightLines.join('\n')
  } else if (direction === 'to-right' && line.leftType === 'modified') {
    // Replace right side line with left content
    const rightLines = modifiedText.value.split('\n')
    const rightIdx = line.rightNum! - 1
    rightLines[rightIdx] = line.leftContent
    modifiedText.value = rightLines.join('\n')
  } else if (direction === 'to-left' && line.rightType === 'added') {
    // Insert right content into left side at the correct position
    const leftLines = originalText.value.split('\n')
    let insertPos = 0
    for (let i = 0; i < index; i++) {
      if (sideByLineData.value[i].leftNum !== null) {
        insertPos = sideByLineData.value[i].leftNum!
      }
    }
    leftLines.splice(insertPos, 0, line.rightContent)
    originalText.value = leftLines.join('\n')
  } else if (direction === 'to-left' && line.rightType === 'modified') {
    // Replace left side line with right content
    const leftLines = originalText.value.split('\n')
    const leftIdx = line.leftNum! - 1
    leftLines[leftIdx] = line.rightContent
    originalText.value = leftLines.join('\n')
  }
  // Re-trigger diff
  hasCompared.value = true
}

// Copy functionality
const copyText = async (text: string, target: 'left' | 'right' | 'inline') => {
  try {
    await navigator.clipboard.writeText(text)
    if (target === 'left') {
      leftCopied.value = true
      setTimeout(() => { leftCopied.value = false }, 2000)
    } else if (target === 'right') {
      rightCopied.value = true
      setTimeout(() => { rightCopied.value = false }, 2000)
    } else {
      inlineCopied.value = true
      setTimeout(() => { inlineCopied.value = false }, 2000)
    }
  } catch {
    // fallback
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 h-full">
    <!-- Input Area -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[200px]">
      <!-- Original Text -->
      <div class="editor-area flex flex-col">
        <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <span class="text-sm font-medium text-muted-foreground">原始文本</span>
        </div>
        <textarea
          v-model="originalText"
          class="editor-textarea flex-1 min-h-[160px]"
          placeholder="输入原始文本..."
          spellcheck="false"
        ></textarea>
      </div>
      <!-- Modified Text -->
      <div class="editor-area flex flex-col">
        <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <span class="text-sm font-medium text-muted-foreground">修改后文本</span>
        </div>
        <textarea
          v-model="modifiedText"
          class="editor-textarea flex-1 min-h-[160px]"
          placeholder="输入修改后文本..."
          spellcheck="false"
        ></textarea>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="flex flex-wrap items-center gap-3">
      <button
        @click="handleCompare"
        class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
      >
        对比
      </button>
      <button
        @click="handleSwap"
        class="px-4 py-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
      >
        交换
      </button>
      <button
        @click="handleClear"
        class="px-4 py-2 text-sm rounded-lg bg-secondary hover:bg-destructive/20 transition-colors"
      >
        清空
      </button>
      <button
        @click="undoMerge"
        :disabled="mergeHistory.length === 0"
        class="px-4 py-2 text-sm rounded-lg bg-secondary transition-colors flex items-center gap-1.5"
        :class="mergeHistory.length > 0 ? 'hover:bg-secondary/80 text-foreground' : 'opacity-40 cursor-not-allowed'"
        title="撤销合并 (⌘Z)"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/>
        </svg>
        撤销
      </button>

      <!-- Granularity Toggle -->
      <div class="ml-auto flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <button
          @click="diffGranularity = 'char'"
          class="px-3 py-1.5 text-xs rounded-md transition-colors"
          :class="diffGranularity === 'char' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        >
          字符
        </button>
        <button
          @click="diffGranularity = 'word'"
          class="px-3 py-1.5 text-xs rounded-md transition-colors"
          :class="diffGranularity === 'word' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        >
          单词
        </button>
      </div>

      <!-- Mode Toggle -->
      <div class="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <button
          @click="diffMode = 'side-by-side'"
          class="px-3 py-1.5 text-xs rounded-md transition-colors"
          :class="diffMode === 'side-by-side' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        >
          逐行对比
        </button>
        <button
          @click="diffMode = 'inline'"
          class="px-3 py-1.5 text-xs rounded-md transition-colors"
          :class="diffMode === 'inline' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
        >
          内联对比
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="hasCompared" class="flex items-center gap-4 text-sm text-muted-foreground">
      <span class="flex items-center gap-1">
        <span class="inline-block w-3 h-3 rounded-sm bg-green-900/60"></span>
        新增 <span class="font-mono text-green-300">{{ stats.added }}</span> 行
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-3 h-3 rounded-sm bg-red-900/60"></span>
        删除 <span class="font-mono text-red-300">{{ stats.removed }}</span> 行
      </span>
    </div>

    <!-- Diff Result -->
    <div v-if="hasCompared" class="editor-area flex-1 overflow-auto relative">
      <!-- Side-by-Side Mode -->
      <div v-if="diffMode === 'side-by-side'" class="font-mono text-sm min-h-[200px]">
        <!-- Copy buttons header -->
        <div class="sticky top-0 z-10 flex border-b border-border bg-slate-900/90 backdrop-blur-sm">
          <div class="w-1/2 flex items-center justify-between px-3 py-1.5 border-r border-border">
            <span class="text-xs text-muted-foreground">原始文本</span>
            <button
              @click="copyText(originalText, 'left')"
              class="p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
              :title="leftCopied ? '已复制' : '复制左侧文本'"
            >
              <!-- Check icon -->
              <svg v-if="leftCopied" class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <!-- Copy icon -->
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
          <div class="w-1/2 flex items-center justify-between px-3 py-1.5">
            <span class="text-xs text-muted-foreground">修改后文本</span>
            <button
              @click="copyText(modifiedText, 'right')"
              class="p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
              :title="rightCopied ? '已复制' : '复制右侧文本'"
            >
              <svg v-if="rightCopied" class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Diff rows -->
        <div
          v-for="(line, idx) in sideByLineData"
          :key="'row-' + idx"
          class="flex group"
        >
          <!-- Left Cell -->
          <div
            class="flex w-1/2 min-w-0 border-r border-border relative"
            :class="{
              'bg-red-900/40': line.leftType === 'removed',
              'bg-red-900/20': line.leftType === 'modified'
            }"
          >
            <span class="inline-block w-10 text-right pr-2 text-muted-foreground/50 select-none shrink-0 py-0.5">
              {{ line.leftNum ?? '' }}
            </span>
            <span
              class="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all"
              :class="{
                'text-red-300': line.leftType === 'removed',
                'text-foreground': line.leftType === 'unchanged' || line.leftType === 'modified'
              }"
            >
              <template v-if="line.leftSegments">
                <span
                  v-for="(seg, sIdx) in line.leftSegments"
                  :key="sIdx"
                  :class="{ 'bg-red-500/30 text-red-200 rounded-sm': seg.type === 'changed' }"
                >{{ seg.text }}</span>
              </template>
              <template v-else>{{ line.leftContent }}</template>
            </span>
            <!-- Merge to right button -->
            <button
              v-if="line.leftType === 'removed' || line.leftType === 'modified'"
              @click="mergeLine(idx, 'to-right')"
              class="absolute right-1 top-1/2 -translate-y-1/2 px-1 py-0.5 rounded text-xs font-mono opacity-0 group-hover:opacity-100 bg-slate-700/70 hover:bg-blue-600/80 text-slate-400 hover:text-white transition-all"
              title="采用左侧内容 → 右侧"
            >&gt;&gt;</button>
          </div>
          <!-- Right Cell -->
          <div
            class="flex w-1/2 min-w-0 relative"
            :class="{
              'bg-green-900/40': line.rightType === 'added',
              'bg-green-900/20': line.rightType === 'modified'
            }"
          >
            <!-- Merge to left button -->
            <button
              v-if="line.rightType === 'added' || line.rightType === 'modified'"
              @click="mergeLine(idx, 'to-left')"
              class="absolute left-1 top-1/2 -translate-y-1/2 px-1 py-0.5 rounded text-xs font-mono opacity-0 group-hover:opacity-100 bg-slate-700/70 hover:bg-blue-600/80 text-slate-400 hover:text-white transition-all z-10"
              title="采用右侧内容 → 左侧"
            >&lt;&lt;</button>
            <span class="inline-block w-10 text-right pr-2 text-muted-foreground/50 select-none shrink-0 py-0.5">
              {{ line.rightNum ?? '' }}
            </span>
            <span
              class="flex-1 px-2 py-0.5 whitespace-pre-wrap break-all"
              :class="{
                'text-green-300': line.rightType === 'added',
                'text-foreground': line.rightType === 'unchanged' || line.rightType === 'modified'
              }"
            >
              <template v-if="line.rightSegments">
                <span
                  v-for="(seg, sIdx) in line.rightSegments"
                  :key="sIdx"
                  :class="{ 'bg-green-500/30 text-green-200 rounded-sm': seg.type === 'changed' }"
                >{{ seg.text }}</span>
              </template>
              <template v-else>{{ line.rightContent }}</template>
            </span>
          </div>
        </div>
      </div>

      <!-- Inline Mode -->
      <div v-else class="relative">
        <!-- Copy button for inline mode -->
        <div class="sticky top-0 z-10 flex justify-between items-center px-4 py-1.5 border-b border-border bg-slate-900/90 backdrop-blur-sm">
          <span class="text-xs text-muted-foreground">内联对比结果</span>
          <button
            @click="copyText(inlineMergedText, 'inline')"
            class="p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
            :title="inlineCopied ? '已复制' : '复制合并文本'"
          >
            <svg v-if="inlineCopied" class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          </button>
        </div>
        <div class="font-mono text-sm p-4 min-h-[200px] whitespace-pre-wrap break-all">
          <template v-for="(part, idx) in charDiffs" :key="idx">
            <span
              v-if="part.removed"
              class="bg-red-900/40 text-red-300 line-through"
            >{{ part.value }}</span>
            <span
              v-else-if="part.added"
              class="bg-green-900/40 text-green-300"
            >{{ part.value }}</span>
            <span v-else>{{ part.value }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!hasCompared" class="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      <p>输入文本后点击"对比"按钮查看差异</p>
    </div>
  </div>
</template>

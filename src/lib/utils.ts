import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLineAndColumn(text: string, index: number): { line: number; column: number } {
  const lines = text.substring(0, index).split('\n')
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

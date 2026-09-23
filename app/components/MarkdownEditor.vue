<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const model = defineModel<string>({ default: '' })
defineProps<{
  disabled?: boolean
  placeholder?: string
}>()

const { t } = useI18n()

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

// Sanitized after every render — content_markdown is admin-authored today, but
// this component is reused wherever markdown → HTML happens, so it never
// trusts its input.
const renderedHtml = computed(() => DOMPurify.sanitize(md.render(model.value || '')))
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-prohealth-400 mb-2">{{ t('markdownEditor.source') }}</p>
      <UTextarea
        v-model="model"
        :rows="16"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full font-mono text-sm"
      />
    </div>
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-prohealth-400 mb-2">{{ t('markdownEditor.preview') }}</p>
      <div
        class="markdown-body h-[26.5rem] overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
        v-html="renderedHtml"
      />
    </div>
  </div>
</template>

<style scoped>
.markdown-body :deep(h1) { font-size: 1.35rem; font-weight: 800; margin: 0.6em 0 0.4em; }
.markdown-body :deep(h2) { font-size: 1.15rem; font-weight: 700; margin: 0.6em 0 0.4em; }
.markdown-body :deep(h3) { font-size: 1.02rem; font-weight: 700; margin: 0.5em 0 0.3em; }
.markdown-body :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { margin: 0.4em 0 0.4em 1.3em; }
.markdown-body :deep(li) { margin: 0.2em 0; }
.markdown-body :deep(a) { color: var(--color-prohealth-600); text-decoration: underline; }
.markdown-body :deep(strong) { font-weight: 700; }
.markdown-body :deep(blockquote) { border-left: 3px solid var(--color-prohealth-200); padding-left: 0.8em; color: var(--color-prohealth-600); }
.markdown-body :deep(code) { background: var(--color-prohealth-100); padding: 0.1em 0.35em; border-radius: 0.25em; font-size: 0.85em; }
</style>

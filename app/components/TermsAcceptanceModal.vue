<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { pendingTermKey, TERM_TYPES, type PendingTermDto } from '~/types/terms'
import { hasLineChanges, lineDiff, type LineDiffPart } from '~/utils/lineDiff'

// One document per step: the first visible item (mandatory AFILIADO first,
// then the optional ASESOR / ALIADO ones unless postponed). Accepting removes
// it from `visible`, so the next one slides in. Optional items offer
// "Recordar más tarde" (usePendingTerms.snooze) — their module stays locked
// until accepted.
const { t } = useI18n()
const { visible, snooze, acceptOne } = usePendingTerms()

const isOpen = computed(() => visible.value.length > 0)
const current = computed<PendingTermDto | null>(() => visible.value[0] ?? null)
const currentKey = computed(() => (current.value ? pendingTermKey(current.value) : ''))

// "Documento X de N" — counts the ones accepted since the modal opened so the
// total doesn't shrink as each step is accepted.
const acceptedThisRound = ref(0)
watch(isOpen, (open) => {
  if (!open) acceptedThisRound.value = 0
})
const step = computed(() => acceptedThisRound.value + 1)
const total = computed(() => acceptedThisRound.value + visible.value.length)

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const renderedHtml = computed(() => DOMPurify.sanitize(md.render(current.value?.contentMarkdown || '')))

const allyHeading = computed(() =>
  current.value?.termType === TERM_TYPES.ALLY && current.value.allyName
    ? t('termsAcceptance.allyHeading', { ally: current.value.allyName })
    : null,
)

// Per-item flags keyed by version + agreement (pendingTermKey), so the same
// version pending for two agreements keeps two independent states.
const scrolledToEnd = reactive<Record<string, boolean>>({})
const checked = reactive<Record<string, boolean>>({})
const activeTab = ref<'contract' | 'changes'>('contract')

const tabs = computed(() => [
  { label: t('termsAcceptance.tabs.contract'), value: 'contract', icon: 'i-lucide-file-text' },
  { label: t('termsAcceptance.tabs.changes'), value: 'changes', icon: 'i-lucide-git-compare' },
])

/** Line diff between the text accepted before and the one to accept now. */
const diff = computed<LineDiffPart[]>(() => {
  const term = current.value
  return term?.previousAcceptance ? lineDiff(term.previousAcceptance.renderedContent, term.contentMarkdown) : []
})

const { formatDate } = useFormatters()
const previousLabel = computed(() => {
  const previous = current.value?.previousAcceptance
  if (!previous) return ''
  return t('termsAcceptance.changesSince', {
    version: previous.versionNumber,
    date: previous.acceptedAt_Display || formatDate(previous.acceptedAt, 'datetime'),
  })
})

const contentEl = ref<HTMLElement | null>(null)

function markIfAtEnd(el: HTMLElement | null) {
  // 4px tolerance — some browsers round scrollHeight/clientHeight sub-pixel.
  if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
    scrolledToEnd[currentKey.value] = true
  }
}

// New step: back to the contract tab, scroll to the top, and enable the
// checkbox right away when the text is short enough to need no scroll.
watch(currentKey, async () => {
  activeTab.value = 'contract'
  await nextTick()
  if (contentEl.value) contentEl.value.scrollTop = 0
  markIfAtEnd(contentEl.value)
}, { immediate: true })
// The modal mounts its content lazily: re-check once the element exists.
watch(contentEl, el => markIfAtEnd(el))

const canAccept = computed(() => !!current.value && !!checked[currentKey.value])

const submitting = ref(false)
async function onAccept() {
  if (!current.value || !canAccept.value) return
  submitting.value = true
  try {
    await acceptOne(current.value)
    acceptedThisRound.value++
  }
  catch {
    // useApi already notified; the step stays open so the user can retry.
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    :open="isOpen"
    :dismissible="false"
    :close="false"
    :ui="{ content: 'max-w-5xl' }"
  >
    <template #content>
      <div v-if="current" class="flex flex-col max-h-[92vh] p-6 gap-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-prohealth-500">
              {{ t('termsAcceptance.title') }} · {{ t('termsAcceptance.step', { current: step, total }) }}
            </p>
            <h2 class="text-lg font-extrabold text-prohealth-900 mt-1">{{ current.title }}</h2>
            <p v-if="allyHeading" class="flex items-center gap-1.5 text-sm text-prohealth-700 mt-0.5">
              <UIcon name="i-lucide-building-2" class="w-4 h-4" />
              {{ allyHeading }}
            </p>
            <p class="text-sm text-prohealth-600 mt-1">
              {{ current.mandatory ? t('termsAcceptance.subtitleMandatory') : t('termsAcceptance.subtitleOptional') }}
            </p>
          </div>
          <span class="text-xs text-prohealth-500 shrink-0 mt-1">
            {{ t('termsAcceptance.version', { version: current.versionNumber }) }}
          </span>
        </div>

        <UTabs
          v-if="current.previousAcceptance"
          v-model="activeTab"
          :items="tabs"
          :content="false"
          size="xs"
        />

        <div
          v-show="activeTab !== 'changes'"
          ref="contentEl"
          class="terms-content h-[55vh] min-h-48 overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-5 text-sm text-prohealth-800"
          @scroll="markIfAtEnd($event.target as HTMLElement)"
          v-html="renderedHtml"
        />

        <div
          v-if="current.previousAcceptance"
          v-show="activeTab === 'changes'"
          class="h-[55vh] min-h-48 overflow-y-auto rounded-lg border border-prohealth-100 bg-white text-xs"
        >
          <p class="sticky top-0 bg-white/95 px-3 py-2 border-b border-prohealth-100 text-prohealth-600">
            {{ previousLabel }}
          </p>
          <p v-if="!hasLineChanges(diff)" class="px-3 py-4 text-prohealth-500">
            {{ t('termsAcceptance.noChanges') }}
          </p>
          <div v-else class="py-1 font-mono">
            <div
              v-for="(part, index) in diff"
              :key="index"
              class="diff-line px-3 whitespace-pre-wrap break-words"
              :class="{
                'bg-green-50 text-green-800': part.kind === 'added',
                'bg-red-50 text-red-700 line-through decoration-red-300': part.kind === 'removed',
                'text-prohealth-400': part.kind === 'unchanged',
              }"
            >
              <span class="select-none inline-block w-4" aria-hidden="true">{{ part.kind === 'added' ? '+' : part.kind === 'removed' ? '−' : ' ' }}</span>{{ part.text || ' ' }}
            </div>
          </div>
        </div>

        <UCheckbox
          v-model="checked[currentKey]"
          :disabled="!scrolledToEnd[currentKey]"
          :label="scrolledToEnd[currentKey]
            ? t('termsAcceptance.acceptLabel')
            : t('termsAcceptance.scrollHint')"
        />

        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <UButton
            v-if="!current.mandatory"
            color="neutral"
            variant="soft"
            icon="i-lucide-clock"
            :disabled="submitting"
            @click="snooze"
          >
            {{ t('termsAcceptance.remindLater') }}
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="submitting"
            :disabled="!canAccept"
            @click="onAccept"
          >
            {{ step < total ? t('termsAcceptance.acceptAndNext') : t('termsAcceptance.accept') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.terms-content :deep(h1) { font-size: 1.2rem; font-weight: 800; margin: 0.6em 0 0.4em; }
.terms-content :deep(h2) { font-size: 1.05rem; font-weight: 700; margin: 0.6em 0 0.4em; }
.terms-content :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.terms-content :deep(ul), .terms-content :deep(ol) { margin: 0.4em 0 0.4em 1.3em; }
.terms-content :deep(li) { margin: 0.2em 0; }
.terms-content :deep(strong) { font-weight: 700; }
</style>

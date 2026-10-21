<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { pendingTermKey, TERM_TYPES, type PendingTermDto } from '~/types/terms'
import { hasLineChanges, lineDiff, type LineDiffPart } from '~/utils/lineDiff'

const { t } = useI18n()
const { pending, acceptAll } = usePendingTerms()

const isOpen = computed(() => pending.value.length > 0)

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
function renderedHtml(markdown: string) {
  return DOMPurify.sanitize(md.render(markdown || ''))
}

/**
 * Pending items in display order, grouped: each AFILIADO / ASESOR item on its
 * own, ALIADO items by ally (backend V189 serves one item per agreement, so a
 * user in several allies sees each ally's agreements under its name).
 */
interface TermsGroup {
  key: string
  heading: string | null
  items: PendingTermDto[]
}

const groups = computed<TermsGroup[]>(() => {
  const result: TermsGroup[] = []
  const byAlly = new Map<string, TermsGroup>()
  for (const term of pending.value) {
    if (term.termType !== TERM_TYPES.ALLY || !term.allyUuid) {
      result.push({ key: pendingTermKey(term), heading: null, items: [term] })
      continue
    }
    let group = byAlly.get(term.allyUuid)
    if (!group) {
      group = {
        key: `ally:${term.allyUuid}`,
        heading: t('termsAcceptance.allyHeading', { ally: term.allyName ?? '' }),
        items: [],
      }
      byAlly.set(term.allyUuid, group)
      result.push(group)
    }
    group.items.push(term)
  }
  return result
})

// One "scrolled to the end" + "checked" flag per pending item, keyed by
// version + agreement (pendingTermKey) so re-renders (e.g. an item dropping
// off mid-flow) don't desync indices, and the same version pending for two
// agreements keeps two independent flags.
const scrolledToEnd = reactive<Record<string, boolean>>({})
const checked = reactive<Record<string, boolean>>({})
const activeTab = reactive<Record<string, string>>({})

watch(pending, (list) => {
  for (const term of list) {
    const key = pendingTermKey(term)
    if (!(key in scrolledToEnd)) scrolledToEnd[key] = false
    if (!(key in checked)) checked[key] = false
    if (!(key in activeTab)) activeTab[key] = 'contract'
  }
}, { immediate: true })

const tabs = computed(() => [
  { label: t('termsAcceptance.tabs.contract'), value: 'contract', icon: 'i-lucide-file-text' },
  { label: t('termsAcceptance.tabs.changes'), value: 'changes', icon: 'i-lucide-git-compare' },
])

/** Line diff between the text accepted before and the one to accept now (memoized per item). */
const diffs = computed(() => {
  const result: Record<string, LineDiffPart[]> = {}
  for (const term of pending.value) {
    if (term.previousAcceptance) {
      result[pendingTermKey(term)] = lineDiff(term.previousAcceptance.renderedContent, term.contentMarkdown)
    }
  }
  return result
})

const { formatDate } = useFormatters()
function previousLabel(term: PendingTermDto): string {
  const previous = term.previousAcceptance
  if (!previous) return ''
  return t('termsAcceptance.changesSince', {
    version: previous.versionNumber,
    date: previous.acceptedAt_Display || formatDate(previous.acceptedAt, 'datetime'),
  })
}

function onContentScroll(key: string, event: Event) {
  const el = event.target as HTMLElement
  // 4px tolerance — some browsers round scrollHeight/clientHeight sub-pixel.
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
    scrolledToEnd[key] = true
  }
}

const allChecked = computed(() =>
  pending.value.length > 0 && pending.value.every(term => checked[pendingTermKey(term)]),
)

const submitting = ref(false)
async function onContinue() {
  if (!allChecked.value) return
  submitting.value = true
  try {
    await acceptAll(pending.value.map(term => ({
      termsVersionUuid: term.termsVersionUuid,
      allyAgreementUuid: term.allyAgreementUuid,
    })))
  }
  catch {
    // useApi already notified; modal stays open so the user can retry.
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
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #content>
      <div class="p-6 space-y-5">
        <div>
          <h2 class="text-lg font-extrabold text-prohealth-900">{{ t('termsAcceptance.title') }}</h2>
          <p class="text-sm text-prohealth-600 mt-1">{{ t('termsAcceptance.subtitle') }}</p>
        </div>

        <div class="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
          <section v-for="group in groups" :key="group.key" class="space-y-4">
            <h3 v-if="group.heading" class="flex items-center gap-2 font-extrabold text-prohealth-900">
              <UIcon name="i-lucide-building-2" class="w-4 h-4 text-prohealth-600" />
              {{ group.heading }}
            </h3>

            <div v-for="term in group.items" :key="pendingTermKey(term)" class="space-y-2">
              <div class="flex items-baseline justify-between gap-3">
                <h4 class="font-bold text-prohealth-900">{{ term.title }}</h4>
                <span class="text-xs text-prohealth-500 shrink-0">
                  {{ t('termsAcceptance.version', { version: term.versionNumber }) }}
                </span>
              </div>

              <UTabs
                v-if="term.previousAcceptance"
                v-model="activeTab[pendingTermKey(term)]"
                :items="tabs"
                :content="false"
                size="xs"
              />

              <div
                v-show="activeTab[pendingTermKey(term)] !== 'changes'"
                class="terms-content h-56 overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
                @scroll="onContentScroll(pendingTermKey(term), $event)"
                v-html="renderedHtml(term.contentMarkdown)"
              />

              <div
                v-if="term.previousAcceptance"
                v-show="activeTab[pendingTermKey(term)] === 'changes'"
                class="h-56 overflow-y-auto rounded-lg border border-prohealth-100 bg-white text-xs"
              >
                <p class="sticky top-0 bg-white/95 px-3 py-2 border-b border-prohealth-100 text-prohealth-600">
                  {{ previousLabel(term) }}
                </p>
                <p
                  v-if="!hasLineChanges(diffs[pendingTermKey(term)] ?? [])"
                  class="px-3 py-4 text-prohealth-500"
                >
                  {{ t('termsAcceptance.noChanges') }}
                </p>
                <div v-else class="py-1 font-mono">
                  <div
                    v-for="(part, index) in diffs[pendingTermKey(term)] ?? []"
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
                v-model="checked[pendingTermKey(term)]"
                :disabled="!scrolledToEnd[pendingTermKey(term)]"
                :label="scrolledToEnd[pendingTermKey(term)]
                  ? t('termsAcceptance.acceptLabel')
                  : t('termsAcceptance.scrollHint')"
              />
            </div>
          </section>
        </div>

        <UButton
          block
          color="primary"
          :loading="submitting"
          :disabled="!allChecked"
          @click="onContinue"
        >
          {{ t('termsAcceptance.continue') }}
        </UButton>
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

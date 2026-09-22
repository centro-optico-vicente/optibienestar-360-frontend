<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const { t } = useI18n()
const { pending, acceptAll } = usePendingTerms()

const isOpen = computed(() => pending.value.length > 0)

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
function renderedHtml(markdown: string) {
  return DOMPurify.sanitize(md.render(markdown || ''))
}

// One "scrolled to the end" + "checked" flag per pending term, keyed by
// termsVersionUuid so re-renders (e.g. a term dropping off mid-flow) don't
// desync indices.
const scrolledToEnd = reactive<Record<string, boolean>>({})
const checked = reactive<Record<string, boolean>>({})

watch(pending, (list) => {
  for (const term of list) {
    if (!(term.termsVersionUuid in scrolledToEnd)) scrolledToEnd[term.termsVersionUuid] = false
    if (!(term.termsVersionUuid in checked)) checked[term.termsVersionUuid] = false
  }
}, { immediate: true })

function onContentScroll(uuid: string, event: Event) {
  const el = event.target as HTMLElement
  // 4px tolerance — some browsers round scrollHeight/clientHeight sub-pixel.
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
    scrolledToEnd[uuid] = true
  }
}

const allChecked = computed(() =>
  pending.value.length > 0 && pending.value.every(term => checked[term.termsVersionUuid]),
)

const submitting = ref(false)
async function onContinue() {
  if (!allChecked.value) return
  submitting.value = true
  try {
    await acceptAll(pending.value.map(term => term.termsVersionUuid))
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
          <div v-for="term in pending" :key="term.termsVersionUuid" class="space-y-2">
            <h3 class="font-bold text-prohealth-900">{{ term.title }}</h3>

            <div
              class="terms-content h-56 overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
              @scroll="onContentScroll(term.termsVersionUuid, $event)"
              v-html="renderedHtml(term.contentMarkdown)"
            />

            <UCheckbox
              v-model="checked[term.termsVersionUuid]"
              :disabled="!scrolledToEnd[term.termsVersionUuid]"
              :label="scrolledToEnd[term.termsVersionUuid]
                ? t('termsAcceptance.acceptLabel')
                : t('termsAcceptance.scrollHint')"
            />
          </div>
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

<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { TERM_TYPES, type TermType, type TermsAcceptanceHistoryDto } from '~/types/terms'

// "Mis contratos" — every contract the signed-in user accepted (backend
// GET /v1/me/terms/acceptances, V189), grouped by contract type and, for
// ALIADO, by ally. Each row expands to the text exactly as accepted. Any
// authenticated user: the endpoint is scoped by the JWT subject, same as the
// acceptance modal, so no permission gate.
definePageMeta({ layout: 'dashboard' })

const { t } = useI18n()
const { formatDate } = useFormatters()

useSeoMeta({ title: () => t('common.seoTitle', { page: t('myContracts.title') }) })

const acceptances = ref<TermsAcceptanceHistoryDto[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    acceptances.value = await useApi<TermsAcceptanceHistoryDto[]>('/v1/me/terms/acceptances')
  }
  catch {
    // useApi already shows the error toast
    acceptances.value = []
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

const TYPE_ORDER: TermType[] = [TERM_TYPES.MEMBER, TERM_TYPES.ADVISOR, TERM_TYPES.ALLY]

interface ContractGroup {
  key: string
  heading: string
  icon: string
  items: TermsAcceptanceHistoryDto[]
}

/** By type (AFILIADO, ASESOR, ALIADO), ALIADO split by ally; newest first inside each group (API order). */
const groups = computed<ContractGroup[]>(() => {
  const result: ContractGroup[] = []
  for (const type of TYPE_ORDER) {
    const ofType = acceptances.value.filter(a => a.termType === type)
    if (ofType.length === 0) continue
    if (type !== TERM_TYPES.ALLY) {
      result.push({ key: type, heading: t(`myContracts.types.${type}`), icon: typeIcon(type), items: ofType })
      continue
    }
    const byAlly = new Map<string, ContractGroup>()
    for (const acceptance of ofType) {
      const allyKey = acceptance.allyUuid ?? 'none'
      let group = byAlly.get(allyKey)
      if (!group) {
        group = {
          key: `${type}:${allyKey}`,
          heading: acceptance.allyName
            ? t('myContracts.allyHeading', { ally: acceptance.allyName })
            : t('myContracts.allyUnlinked'),
          icon: typeIcon(type),
          items: [],
        }
        byAlly.set(allyKey, group)
      }
      group.items.push(acceptance)
    }
    result.push(...byAlly.values())
  }
  return result
})

function typeIcon(type: TermType): string {
  if (type === TERM_TYPES.MEMBER) return 'i-lucide-id-card'
  if (type === TERM_TYPES.ADVISOR) return 'i-lucide-briefcase'
  return 'i-lucide-building-2'
}

const expanded = reactive<Record<string, boolean>>({})
function toggle(uuid: string) {
  expanded[uuid] = !expanded[uuid]
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
function renderedHtml(markdown: string) {
  return DOMPurify.sanitize(md.render(markdown || ''))
}

function acceptedAt(acceptance: TermsAcceptanceHistoryDto): string {
  return acceptance.acceptedAt_Display || formatDate(acceptance.acceptedAt, 'datetime')
}

function channelLabel(acceptance: TermsAcceptanceHistoryDto): string {
  return t(`myContracts.channels.${acceptance.channel}`, acceptance.channel)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('myContracts.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">{{ t('myContracts.subtitle') }}</p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        :aria-label="t('myContracts.refresh')"
        @click="load"
      />
    </div>

    <div v-if="loading && acceptances.length === 0" class="space-y-3">
      <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-2xl" />
    </div>

    <div
      v-else-if="acceptances.length === 0"
      class="bg-white rounded-2xl border border-prohealth-100 px-5 py-12 text-center text-prohealth-500"
    >
      {{ t('myContracts.empty') }}
    </div>

    <template v-else>
      <section
        v-for="group in groups"
        :key="group.key"
        class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden"
      >
        <h2 class="flex items-center gap-2 px-5 py-3 border-b border-prohealth-100 font-bold text-prohealth-900">
          <UIcon :name="group.icon" class="w-4 h-4 text-prohealth-600" />
          {{ group.heading }}
        </h2>

        <ul class="divide-y divide-prohealth-100">
          <li v-for="acceptance in group.items" :key="acceptance.uuid">
            <button
              type="button"
              class="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-prohealth-50/60 transition-colors"
              :aria-expanded="!!expanded[acceptance.uuid]"
              @click="toggle(acceptance.uuid)"
            >
              <UIcon
                :name="expanded[acceptance.uuid] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="w-4 h-4 text-prohealth-500 shrink-0"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-prohealth-900 truncate">{{ acceptance.title }}</p>
                <p class="text-xs text-prohealth-500">
                  {{ t('myContracts.version', { version: acceptance.versionNumber }) }}
                  · {{ t('myContracts.acceptedAt', { date: acceptedAt(acceptance) }) }}
                  · {{ channelLabel(acceptance) }}
                </p>
              </div>
            </button>

            <div v-if="expanded[acceptance.uuid]" class="px-5 pb-4 space-y-2">
              <UAlert
                v-if="acceptance.contentReconstructed"
                color="warning"
                variant="soft"
                icon="i-lucide-info"
                :description="t('myContracts.reconstructed')"
              />
              <div
                class="terms-content max-h-[60vh] overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
                v-html="renderedHtml(acceptance.renderedContent)"
              />
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.terms-content :deep(h1) { font-size: 1.2rem; font-weight: 800; margin: 0.6em 0 0.4em; }
.terms-content :deep(h2) { font-size: 1.05rem; font-weight: 700; margin: 0.6em 0 0.4em; }
.terms-content :deep(p) { margin: 0.5em 0; line-height: 1.6; }
.terms-content :deep(ul), .terms-content :deep(ol) { margin: 0.4em 0 0.4em 1.3em; }
.terms-content :deep(li) { margin: 0.2em 0; }
.terms-content :deep(strong) { font-weight: 700; }
</style>

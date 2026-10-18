<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { toSelectItems, type SelectItem } from '~/types/options'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { TERMS_TEMPLATE_VARIABLES, type AllySegment, type TermsVersionDto, type TermType } from '~/types/terms'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'ORGANIZATION_VIEW',
})

const { t } = useI18n()

useSeoMeta({ title: () => t('organization.seoTitle') })

const organizationApi = useOrganization()
const currenciesApi = useCurrencies()
const termsApi = useTerms()
const alliesApi = useAllies()
const { can } = usePermissions()
const { formatDate } = useFormatters()
const toast = useToast()

const canUpdate = computed(() => can('ORGANIZATION_UPDATE'))
const canManageTerms = computed(() => can('TERMS_CREATE') || can('TERMS_UPDATE'))

const loading = ref(false)
const isSubmitting = ref(false)
const currencyItems = ref<SelectItem[]>([])
const loadingCurrencies = ref(false)

const state = reactive({
  name: '',
  legalName: '',
  taxIdentifier: '',
  logoKey: '',
  whatsapp: '',
  instagram: '',
  facebook: '',
  officialCurrencyUuid: undefined as string | undefined,
  referenceCurrencyUuid: undefined as string | undefined,
  autoApproveCommissions: false,
  registryState: '',
  signingCity: '',
  serviceArea: '',
})

const schema = computed(() =>
  z.object({
    name: z.string().min(1, t('validation.required')),
    legalName: z.string().optional().or(z.literal('')),
    taxIdentifier: z.string().optional().or(z.literal('')),
    logoKey: z.string().optional().or(z.literal('')),
    whatsapp: z
      .string()
      .max(30, t('validation.maxChars', { n: 30 }))
      .optional()
      .or(z.literal('')),
    instagram: z
      .string()
      .max(255, t('validation.maxChars', { n: 255 }))
      .optional()
      .or(z.literal('')),
    facebook: z
      .string()
      .max(255, t('validation.maxChars', { n: 255 }))
      .optional()
      .or(z.literal('')),
    officialCurrencyUuid: z.string().optional(),
    referenceCurrencyUuid: z.string().optional(),
    registryState: z
      .string()
      .max(80, t('validation.maxChars', { n: 80 }))
      .optional()
      .or(z.literal('')),
    signingCity: z
      .string()
      .max(80, t('validation.maxChars', { n: 80 }))
      .optional()
      .or(z.literal('')),
    serviceArea: z
      .string()
      .max(150, t('validation.maxChars', { n: 150 }))
      .optional()
      .or(z.literal('')),
  })
)

// Snapshot of the last server-loaded state, used to warn before a refresh
// throws away unsaved edits.
const snapshot = ref('')
function snapshotState() { return JSON.stringify(state) }
const isDirty = computed(() => snapshot.value !== '' && snapshotState() !== snapshot.value)
const discardConfirmOpen = ref(false)

async function loadCurrencyOptions() {
  loadingCurrencies.value = true
  try {
    currencyItems.value = toSelectItems(await currenciesApi.options())
  }
  catch {
    currencyItems.value = []
  }
  finally {
    loadingCurrencies.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const org = await organizationApi.ensureLoaded()
    if (org) {
      state.name = org.name
      state.legalName = org.legalName ?? ''
      state.taxIdentifier = org.taxIdentifier ?? ''
      state.logoKey = org.logoKey ?? ''
      state.whatsapp = org.whatsapp ?? ''
      state.instagram = org.instagram ?? ''
      state.facebook = org.facebook ?? ''
      state.officialCurrencyUuid = org.officialCurrency_Uuid ?? undefined
      state.referenceCurrencyUuid = org.referenceCurrency_Uuid ?? undefined
      state.autoApproveCommissions = org.autoApproveCommissions
      state.registryState = org.registryState ?? ''
      state.signingCity = org.signingCity ?? ''
      state.serviceArea = org.serviceArea ?? ''
    }
    else {
      toast.add({ title: t('organization.loadError'), color: 'error', icon: 'i-lucide-alert-triangle' })
    }
  }
  finally {
    loading.value = false
    snapshot.value = snapshotState()
  }
}

function onRefresh() {
  if (isDirty.value) discardConfirmOpen.value = true
  else load()
}

function discardAndRefresh() {
  discardConfirmOpen.value = false
  load()
}

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  if (!canUpdate.value) return
  isSubmitting.value = true
  try {
    const updated = await organizationApi.update({
      name: state.name,
      legalName: state.legalName || undefined,
      taxIdentifier: state.taxIdentifier || undefined,
      logoKey: state.logoKey || undefined,
      whatsapp: state.whatsapp || undefined,
      instagram: state.instagram || undefined,
      facebook: state.facebook || undefined,
      officialCurrencyUuid: state.officialCurrencyUuid,
      referenceCurrencyUuid: state.referenceCurrencyUuid,
      autoApproveCommissions: state.autoApproveCommissions,
      registryState: state.registryState || undefined,
      signingCity: state.signingCity || undefined,
      serviceArea: state.serviceArea || undefined,
    })
    state.name = updated.name
    state.legalName = updated.legalName ?? ''
    state.taxIdentifier = updated.taxIdentifier ?? ''
    state.logoKey = updated.logoKey ?? ''
    state.whatsapp = updated.whatsapp ?? ''
    state.instagram = updated.instagram ?? ''
    state.facebook = updated.facebook ?? ''
    state.officialCurrencyUuid = updated.officialCurrency_Uuid ?? undefined
    state.referenceCurrencyUuid = updated.referenceCurrency_Uuid ?? undefined
    state.autoApproveCommissions = updated.autoApproveCommissions
    state.registryState = updated.registryState ?? ''
    state.signingCity = updated.signingCity ?? ''
    state.serviceArea = updated.serviceArea ?? ''
    snapshot.value = snapshotState()
    // Served T&C resolve {{org.*}} from these fields, so the previews are now stale.
    for (const type of TERM_TYPES) termTabs[type].loaded = false
    loadTermType(activeTermTab.value)
    toast.add({
      title: t('organization.updatedToast'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  }
  catch {
    // handled by useApi
  }
  finally {
    isSubmitting.value = false
  }
}

// ---- Términos y condiciones (uno por TermType) ----
const TERM_TYPES: TermType[] = ['AFILIADO', 'PROMOTOR', 'ALIADO']
const activeTermTab = ref<TermType>('AFILIADO')

interface TermTabState {
  loaded: boolean
  loading: boolean
  currentTitle: string | null
  currentContent: string | null
  currentValidFrom: string | null
  /** The row being edited: the scheduled (not-yet-vigente) version if one exists, otherwise a fresh draft. */
  editingUuid: string | null
  title: string
  contentMarkdown: string
  isPublic: boolean
  validFrom: string
  /** Server-rendered text (placeholders resolved) of the version shown in the editor, as last saved. */
  previewRendered: string | null
  /** Every version of the type, `validFrom` DESC — the editor works on the stream matching the scope below. */
  versions: TermsVersionDto[]
  /** ALIADO-only optional scope (V183): all empty = general template. Picks the stream being edited. */
  allyTypeUuid: string | undefined
  segment: AllySegment | undefined
  allyUuid: string | undefined
}

function emptyTabState(): TermTabState {
  return {
    loaded: false,
    loading: false,
    currentTitle: null,
    currentContent: null,
    currentValidFrom: null,
    editingUuid: null,
    title: '',
    contentMarkdown: '',
    isPublic: false,
    validFrom: '',
    previewRendered: null,
    versions: [],
    allyTypeUuid: undefined,
    segment: undefined,
    allyUuid: undefined,
  }
}

const termTabs = reactive<Record<TermType, TermTabState>>({
  AFILIADO: emptyTabState(),
  PROMOTOR: emptyTabState(),
  ALIADO: emptyTabState(),
})

const activeTerm = computed(() => termTabs[activeTermTab.value])
const savingTerm = ref(false)

/** Same stream = same scope combination (AFILIADO / PROMOTOR rows never carry one). */
function inTabStream(v: TermsVersionDto, tab: TermTabState) {
  // `?? undefined` on both sides: a cleared select may hand back `null`.
  return (v.allyType_Uuid ?? undefined) === (tab.allyTypeUuid ?? undefined)
    && (v.segment ?? undefined) === (tab.segment ?? undefined)
    && (v.ally_Uuid ?? undefined) === (tab.allyUuid ?? undefined)
}

/**
 * Loads the stream selected by the tab's scope into the editor: its live
 * version and its scheduled one (rows are `validFrom` DESC with `isVigent`).
 * A stream with no version yet keeps whatever is typed in the editor, so
 * picking a scope for a brand-new template doesn't wipe the draft.
 */
function applyTermStream(tab: TermTabState) {
  const stream = tab.versions.filter(v => inTabStream(v, tab))
  const current = stream.find(v => v.isVigent)
  const scheduled = stream.find(v => !v.isVigent)

  tab.currentTitle = current?.title ?? null
  tab.currentContent = current?.contentMarkdown ?? null
  tab.currentValidFrom = current?.validFrom ?? null
  tab.editingUuid = scheduled?.uuid ?? null

  if (!current && !scheduled) {
    tab.previewRendered = null
    return
  }
  tab.title = scheduled?.title ?? current?.title ?? ''
  tab.contentMarkdown = scheduled?.contentMarkdown ?? current?.contentMarkdown ?? ''
  tab.isPublic = scheduled?.isPublic ?? current?.isPublic ?? false
  tab.validFrom = scheduled ? scheduled.validFrom.slice(0, 16) : ''
  tab.previewRendered = scheduled?.contentRendered ?? current?.contentRendered ?? null
}

/**
 * One request per tab: the list is ordered `validFrom` DESC and each row carries
 * `isVigent`, so both the live version and the scheduled one come from it —
 * `/terms/current/{type}` would only add a 404 for types with no version yet.
 */
async function loadTermType(type: TermType, force = false) {
  const tab = termTabs[type]
  if (tab.loading || (tab.loaded && !force)) return
  tab.loading = true
  try {
    tab.versions = await termsApi.list(type)
    applyTermStream(tab)
    tab.loaded = true
  }
  catch {
    // useApi already notified
  }
  finally {
    tab.loading = false
  }
}

function selectTermTab(type: TermType) {
  activeTermTab.value = type
  loadTermType(type)
}

async function saveTermTab(type: TermType) {
  if (!canManageTerms.value) return
  const tab = termTabs[type]
  if (!tab.title.trim() || !tab.contentMarkdown.trim() || !tab.validFrom) {
    toast.add({ title: t('organization.terms.missingFields'), color: 'error', icon: 'i-lucide-alert-circle' })
    return
  }
  savingTerm.value = true
  try {
    const validFromIso = new Date(tab.validFrom).toISOString()
    if (tab.editingUuid) {
      await termsApi.update(tab.editingUuid, {
        title: tab.title,
        contentMarkdown: tab.contentMarkdown,
        isPublic: tab.isPublic,
        validFrom: validFromIso,
      })
    }
    else {
      // The scope only travels on create: an update edits the scheduled row of
      // the stream already selected by that same scope.
      await termsApi.create({
        termType: type,
        title: tab.title,
        contentMarkdown: tab.contentMarkdown,
        isPublic: tab.isPublic,
        validFrom: validFromIso,
        ...(type === 'ALIADO'
          ? {
              allyTypeUuid: tab.allyTypeUuid || undefined,
              segment: tab.segment || undefined,
              allyUuid: tab.allyUuid || undefined,
            }
          : {}),
      })
    }
    toast.add({ title: t('organization.terms.savedToast'), color: 'success', icon: 'i-lucide-check-circle' })
    await loadTermType(type, true)
  }
  catch {
    // useApi already notified (e.g. a version is already scheduled — 422)
  }
  finally {
    savingTerm.value = false
  }
}

// ---- ALIADO template scope (V183) ----
// Picking a scope switches the editor to that scope's stream.
watch(
  () => [termTabs.ALIADO.allyTypeUuid, termTabs.ALIADO.segment, termTabs.ALIADO.allyUuid],
  () => { if (termTabs.ALIADO.loaded) applyTermStream(termTabs.ALIADO) },
)

const segmentItems = computed(() => (['B2B', 'B2P'] as AllySegment[]).map(value => ({
  label: t(`allies.segments.${value}`),
  value,
})))

const allyTypeItems = ref<SelectItem[]>([])
const allyTypeItemsLoaded = ref(false)
async function loadAllyTypeItems() {
  if (allyTypeItemsLoaded.value) return
  try {
    allyTypeItems.value = toSelectItems(await useCatalogOptions('ally-types').options({ limit: 200 }))
    allyTypeItemsLoaded.value = true
  }
  catch {
    allyTypeItems.value = []
  }
}

// Server-side ally search. The selected ally is kept in the results so its
// label still shows when it comes from a version row rather than a search.
const selectedAllyItem = ref<SelectItem | null>(null)
async function searchAllies(q: string): Promise<SelectItem[]> {
  const page = await alliesApi.list({ q, size: 20 })
  const items = (page.content ?? []).map(a => ({ label: a.name, value: a.uuid }))
  const selected = selectedAllyItem.value
  return selected && !items.some(i => i.value === selected.value) ? [selected, ...items] : items
}

/** "Aliado X · Tipo Y · Segmento Z", or "General" when the template has no scope. */
function termScopeLabel(v: TermsVersionDto) {
  const parts = [v.ally_Display, v.allyType_Display, v.segment_Display].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('organization.terms.scope.general')
}

/** A vigente row is the stream's live version unless a later vigente row of the same stream exists. */
function termRowStatus(v: TermsVersionDto, versions: TermsVersionDto[]) {
  if (!v.isVigent) return 'scheduled'
  const sameStream = (o: TermsVersionDto) =>
    (o.allyType_Uuid ?? null) === (v.allyType_Uuid ?? null)
    && (o.segment ?? null) === (v.segment ?? null)
    && (o.ally_Uuid ?? null) === (v.ally_Uuid ?? null)
  const live = versions.find(o => o.isVigent && sameStream(o))
  return live?.uuid === v.uuid ? 'current' : 'previous'
}

function editTermStream(v: TermsVersionDto) {
  const tab = termTabs.ALIADO
  selectedAllyItem.value = v.ally_Uuid ? { label: v.ally_Display ?? v.ally_Uuid, value: v.ally_Uuid } : null
  tab.allyTypeUuid = v.allyType_Uuid ?? undefined
  tab.segment = v.segment ?? undefined
  tab.allyUuid = v.ally_Uuid ?? undefined
  applyTermStream(tab)
}

watch(activeTermTab, (type) => { if (type === 'ALIADO') loadAllyTypeItems() })

// ---- Template variables help + rendered preview ----
const showTermPreview = ref(false)
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
const termPreviewHtml = computed(() => DOMPurify.sanitize(md.render(activeTerm.value.previewRendered || '')))

onMounted(() => {
  load()
  loadCurrencyOptions()
  loadTermType(activeTermTab.value)
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('organization.title') }}</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          {{ t('organization.subtitle') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshButton
          :loading="loading"
          :icon-only="false"
          :label="t('common.refresh')"
          :title="t('common.refreshRecord')"
          @refresh="onRefresh"
        />
        <UButton
          v-if="canUpdate"
          type="submit"
          form="organization-form"
          color="info"
          variant="outline"
          icon="i-lucide-save"
          :loading="isSubmitting"
          :disabled="loading"
        >
          {{ t('organization.saveButton') }}
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
      <span class="text-sm">{{ t('common.loading') }}</span>
    </div>

    <UForm
      v-else
      id="organization-form"
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- Datos generales -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-prohealth-900">{{ t('organization.sections.general') }}</h2>

          <UFormField :label="t('organization.fields.name')" name="name">
            <UInput
              v-model="state.name"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField :label="t('organization.fields.legalName')" name="legalName">
            <UInput
              v-model="state.legalName"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField :label="t('organization.fields.taxIdentifier')" name="taxIdentifier">
            <UInput
              v-model="state.taxIdentifier"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('organization.fields.registryState')"
            :help="t('organization.fields.registryStateHelp')"
            name="registryState"
          >
            <UInput
              v-model="state.registryState"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('organization.fields.signingCity')"
            :help="t('organization.fields.signingCityHelp')"
            name="signingCity"
          >
            <UInput
              v-model="state.signingCity"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('organization.fields.serviceArea')"
            :help="t('organization.fields.serviceAreaHelp')"
            name="serviceArea"
          >
            <UInput
              v-model="state.serviceArea"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('organization.fields.logoKey')"
            :help="t('organization.fields.logoKeyHelp')"
            name="logoKey"
          >
            <UInput
              v-model="state.logoKey"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
        </div>

        <!-- Monedas -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-prohealth-900">{{ t('organization.sections.currencies') }}</h2>

          <UFormField
            :label="t('organization.fields.officialCurrency')"
            :help="t('organization.fields.officialCurrencyHelp')"
            name="officialCurrencyUuid"
          >
            <USelectMenu
              v-model="state.officialCurrencyUuid"
              :items="currencyItems"
              label-key="label"
              value-key="value"
              :loading="loadingCurrencies"
              :search-input="false"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>

          <UFormField
            :label="t('organization.fields.referenceCurrency')"
            :help="t('organization.fields.referenceCurrencyHelp')"
            name="referenceCurrencyUuid"
          >
            <USelectMenu
              v-model="state.referenceCurrencyUuid"
              :items="currencyItems"
              label-key="label"
              value-key="value"
              :loading="loadingCurrencies"
              :search-input="false"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
        </div>

        <!-- Comisiones -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-prohealth-900">{{ t('organization.sections.commissions') }}</h2>

          <UFormField :label="t('organization.fields.autoApproveCommissions')" name="autoApproveCommissions">
            <div class="flex items-start gap-3">
              <USwitch v-model="state.autoApproveCommissions" :disabled="!canUpdate || isSubmitting" />
              <p class="text-xs text-prohealth-700/70">{{ t('organization.fields.autoApproveCommissionsHelp') }}</p>
            </div>
          </UFormField>
        </div>

        <!-- Redes sociales -->
        <div class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm space-y-4">
          <div>
            <h2 class="text-base font-bold text-prohealth-900">{{ t('organization.sections.socialLinks') }}</h2>
            <p class="text-xs text-prohealth-700/70 mt-0.5">{{ t('organization.sections.socialLinksHelp') }}</p>
          </div>
          <UFormField :label="t('organization.fields.whatsapp')" name="whatsapp">
            <UInput
              v-model="state.whatsapp"
              icon="i-simple-icons-whatsapp"
              :placeholder="t('organization.fields.whatsappPlaceholder')"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
          <UFormField :label="t('organization.fields.instagram')" name="instagram">
            <UInput
              v-model="state.instagram"
              icon="i-simple-icons-instagram"
              :placeholder="t('organization.fields.instagramPlaceholder')"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
          <UFormField :label="t('organization.fields.facebook')" name="facebook">
            <UInput
              v-model="state.facebook"
              icon="i-simple-icons-facebook"
              :placeholder="t('organization.fields.facebookPlaceholder')"
              class="w-full"
              :disabled="!canUpdate || isSubmitting"
            />
          </UFormField>
        </div>
      </div>
    </UForm>

    <!-- Términos y condiciones por rol -->
    <div v-if="!loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 shadow-sm">
      <h2 class="text-base font-bold text-prohealth-900">{{ t('organization.sections.terms') }}</h2>
      <p class="text-xs text-prohealth-700/70 mt-0.5 mb-4">{{ t('organization.terms.help') }}</p>

      <div class="flex gap-2 border-b border-prohealth-100 mb-5">
        <button
          v-for="type in TERM_TYPES"
          :key="type"
          type="button"
          class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors"
          :class="activeTermTab === type
            ? 'border-prohealth-600 text-prohealth-900'
            : 'border-transparent text-prohealth-400 hover:text-prohealth-700'"
          @click="selectTermTab(type)"
        >
          {{ t(`organization.terms.types.${type}`) }}
        </button>
      </div>

      <div v-if="activeTerm.loading" class="py-12 flex flex-col items-center justify-center gap-2 text-prohealth-500">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
        <span class="text-sm">{{ t('common.loading') }}</span>
      </div>

      <!-- Keyed on the active type so switching tabs remounts the editor with that
           tab's own state instead of patching the previous tab's inputs. -->
      <div v-else :key="activeTermTab" class="space-y-4">
        <p class="text-xs text-prohealth-700 bg-prohealth-50 rounded-lg p-3">
          {{ t(`organization.terms.audience.${activeTermTab}`) }}
        </p>

        <!-- ALIADO: every template (one stream per scope) with its scope; "Editar" loads that stream. -->
        <div v-if="activeTermTab === 'ALIADO'" class="space-y-2">
          <h3 class="text-sm font-bold text-prohealth-900">{{ t('organization.terms.versionsList.title') }}</h3>
          <p v-if="!activeTerm.versions.length" class="text-xs text-prohealth-700/70">
            {{ t('organization.terms.versionsList.empty') }}
          </p>
          <div v-else class="overflow-x-auto rounded-lg border border-prohealth-100">
            <table class="w-full text-xs">
              <thead class="bg-prohealth-50 text-prohealth-700">
                <tr>
                  <th class="text-left font-semibold px-3 py-2">{{ t('organization.terms.fields.title') }}</th>
                  <th class="text-left font-semibold px-3 py-2">{{ t('organization.terms.versionsList.scope') }}</th>
                  <th class="text-left font-semibold px-3 py-2">{{ t('organization.terms.fields.validFrom') }}</th>
                  <th class="text-left font-semibold px-3 py-2">{{ t('organization.terms.versionsList.status') }}</th>
                  <th class="text-left font-semibold px-3 py-2">{{ t('organization.terms.versionsList.public') }}</th>
                  <th class="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in activeTerm.versions" :key="v.uuid" class="border-t border-prohealth-100">
                  <td class="px-3 py-2 text-prohealth-900">{{ v.title }}</td>
                  <td class="px-3 py-2 text-prohealth-700">{{ termScopeLabel(v) }}</td>
                  <td class="px-3 py-2 text-prohealth-700 whitespace-nowrap">{{ formatDate(v.validFrom, 'datetime') }}</td>
                  <td class="px-3 py-2 text-prohealth-700">
                    {{ t(`organization.terms.versionsList.statuses.${termRowStatus(v, activeTerm.versions)}`) }}
                  </td>
                  <td class="px-3 py-2 text-prohealth-700">{{ v.isPublic ? t('common.yes') : t('common.no') }}</td>
                  <td class="px-3 py-2 text-right">
                    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="editTermStream(v)">
                      {{ t('organization.terms.versionsList.edit') }}
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ALIADO: optional scope. Picks which template stream the editor below works on. -->
        <div v-if="activeTermTab === 'ALIADO'" class="rounded-lg border border-prohealth-100 p-3 space-y-3">
          <div>
            <h3 class="text-sm font-bold text-prohealth-900">{{ t('organization.terms.scope.title') }}</h3>
            <p class="text-xs text-prohealth-700/70 mt-0.5">{{ t('organization.terms.scope.help') }}</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UFormField :label="t('organization.terms.scope.segment')">
              <USelectMenu
                v-model="activeTerm.segment"
                clear
                :items="segmentItems"
                label-key="label"
                value-key="value"
                :search-input="false"
                :placeholder="t('organization.terms.scope.any')"
                :disabled="!canManageTerms"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('organization.terms.scope.allyType')">
              <CommonEntityReferenceSelect
                v-model="activeTerm.allyTypeUuid"
                :items="allyTypeItems"
                entity="ally_type"
                icon="i-lucide-tags"
                :placeholder="t('organization.terms.scope.any')"
                :disabled="!canManageTerms"
              />
            </UFormField>
            <UFormField :label="t('organization.terms.scope.ally')">
              <CommonEntityReferenceSelect
                v-model="activeTerm.allyUuid"
                :search="searchAllies"
                entity="ally"
                icon="i-lucide-handshake"
                :placeholder="t('organization.terms.scope.any')"
                :disabled="!canManageTerms"
              />
            </UFormField>
          </div>
        </div>

        <div v-if="activeTerm.currentContent" class="text-xs text-prohealth-600 bg-prohealth-50 rounded-lg p-3">
          {{ t('organization.terms.currentSince', { date: formatDate(activeTerm.currentValidFrom, 'datetime') }) }}
        </div>
        <div v-else class="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
          {{ t('organization.terms.noCurrent') }}
        </div>
        <div v-if="activeTerm.editingUuid" class="text-xs text-prohealth-600 bg-cyan-50 rounded-lg p-3">
          {{ t('organization.terms.editingScheduled') }}
        </div>

        <UFormField :label="t('organization.terms.fields.title')">
          <UInput v-model="activeTerm.title" class="w-full" :disabled="!canManageTerms" />
        </UFormField>

        <!-- Supported placeholders. Tokens come from a JS constant, not i18n:
             `{` `}` are vue-i18n interpolation syntax. -->
        <div class="text-xs text-prohealth-700 bg-prohealth-50 rounded-lg p-3 space-y-2">
          <p>{{ t('organization.terms.variables.help') }}</p>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <li v-for="variable in TERMS_TEMPLATE_VARIABLES" :key="variable.token">
              <code class="font-mono text-prohealth-900">{{ variable.token }}</code>
              — {{ t(`organization.terms.variables.${variable.key}`) }}
            </li>
          </ul>
        </div>

        <UFormField :label="t('organization.terms.fields.content')">
          <MarkdownEditor v-model="activeTerm.contentMarkdown" :disabled="!canManageTerms" />
        </UFormField>

        <div class="space-y-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="showTermPreview ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            :disabled="!activeTerm.previewRendered"
            @click="showTermPreview = !showTermPreview"
          >
            {{ showTermPreview ? t('organization.terms.preview.hide') : t('organization.terms.preview.show') }}
          </UButton>
          <p v-if="!activeTerm.previewRendered" class="text-xs text-prohealth-700/70">
            {{ t('organization.terms.preview.empty') }}
          </p>
          <template v-else-if="showTermPreview">
            <p class="text-xs text-prohealth-700/70">{{ t('organization.terms.preview.help') }}</p>
            <div
              class="terms-content max-h-96 overflow-y-auto rounded-lg border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm text-prohealth-800"
              v-html="termPreviewHtml"
            />
          </template>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('organization.terms.fields.validFrom')">
            <UInput v-model="activeTerm.validFrom" type="datetime-local" class="w-full" :disabled="!canManageTerms" />
          </UFormField>
          <UFormField :label="t('organization.terms.fields.isPublic')" :help="t('organization.terms.isPublicHelp')">
            <USwitch v-model="activeTerm.isPublic" :disabled="!canManageTerms" />
          </UFormField>
        </div>

        <UButton
          color="primary"
          variant="outline"
          icon="i-lucide-save"
          :loading="savingTerm"
          :disabled="!canManageTerms"
          @click="saveTermTab(activeTermTab)"
        >
          {{ activeTerm.editingUuid ? t('organization.terms.saveScheduled') : t('organization.terms.publishNew') }}
        </UButton>
      </div>
    </div>

    <!-- Discard unsaved changes before refreshing -->
    <UModal v-model:open="discardConfirmOpen" :title="t('common.discardChangesTitle')">
      <template #body>
        <p class="text-sm text-prohealth-700">{{ t('common.discardChangesBody') }}</p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" @click="discardConfirmOpen = false">
            {{ t('common.cancel') }}
          </UButton>
          <UButton color="warning" icon="i-lucide-refresh-cw" @click="discardAndRefresh">
            {{ t('common.discardAndRefresh') }}
          </UButton>
        </div>
      </template>
    </UModal>
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

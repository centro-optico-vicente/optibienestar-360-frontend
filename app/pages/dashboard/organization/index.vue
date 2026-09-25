<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { toSelectItems, type SelectItem } from '~/types/options'
import type { TermType } from '~/types/terms'

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
    snapshot.value = snapshotState()
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
  }
}

const termTabs = reactive<Record<TermType, TermTabState>>({
  AFILIADO: emptyTabState(),
  PROMOTOR: emptyTabState(),
  ALIADO: emptyTabState(),
})

const activeTerm = computed(() => termTabs[activeTermTab.value])
const savingTerm = ref(false)

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
    const versions = await termsApi.list(type)
    const current = versions.find(v => v.isVigent)
    const scheduled = versions.find(v => !v.isVigent)

    tab.currentTitle = current?.title ?? null
    tab.currentContent = current?.contentMarkdown ?? null
    tab.currentValidFrom = current?.validFrom ?? null

    tab.editingUuid = scheduled?.uuid ?? null
    tab.title = scheduled?.title ?? current?.title ?? ''
    tab.contentMarkdown = scheduled?.contentMarkdown ?? current?.contentMarkdown ?? ''
    tab.isPublic = scheduled?.isPublic ?? current?.isPublic ?? false
    tab.validFrom = scheduled ? scheduled.validFrom.slice(0, 16) : ''
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
      await termsApi.create({
        termType: type,
        title: tab.title,
        contentMarkdown: tab.contentMarkdown,
        isPublic: tab.isPublic,
        validFrom: validFromIso,
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

        <UFormField :label="t('organization.terms.fields.content')">
          <MarkdownEditor v-model="activeTerm.contentMarkdown" :disabled="!canManageTerms" />
        </UFormField>

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

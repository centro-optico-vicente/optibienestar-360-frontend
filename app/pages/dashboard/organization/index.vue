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

const savingTerm = ref(false)

async function loadTermType(type: TermType) {
  const tab = termTabs[type]
  try {
    const current = await termsApi.current(type)
    tab.currentTitle = current.title
    tab.currentContent = current.contentMarkdown
    tab.currentValidFrom = current.validFrom
  }
  catch {
    // No current version yet for this type — leave the "current" preview empty.
    tab.currentTitle = null
    tab.currentContent = null
    tab.currentValidFrom = null
  }

  try {
    const list = await termsApi.list(type)
    const scheduled = list.find(v => !v.isVigent)
    if (scheduled) {
      tab.editingUuid = scheduled.uuid
      tab.title = scheduled.title
      tab.contentMarkdown = scheduled.contentMarkdown
      tab.isPublic = scheduled.isPublic
      tab.validFrom = scheduled.validFrom.slice(0, 16)
    }
    else {
      tab.editingUuid = null
      tab.title = tab.currentTitle ?? ''
      tab.contentMarkdown = tab.currentContent ?? ''
      tab.isPublic = false
      tab.validFrom = ''
    }
  }
  catch {
    // useApi already notified
  }
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
    await loadTermType(type)
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
  TERM_TYPES.forEach(loadTermType)
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
          @click="activeTermTab = type"
        >
          {{ t(`organization.terms.types.${type}`) }}
        </button>
      </div>

      <div v-for="type in TERM_TYPES" v-show="activeTermTab === type" :key="type" class="space-y-4">
        <div v-if="termTabs[type].currentContent" class="text-xs text-prohealth-600 bg-prohealth-50 rounded-lg p-3">
          {{ t('organization.terms.currentSince', { date: termTabs[type].currentValidFrom }) }}
        </div>
        <div v-else class="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
          {{ t('organization.terms.noCurrent') }}
        </div>
        <div v-if="termTabs[type].editingUuid" class="text-xs text-prohealth-600 bg-cyan-50 rounded-lg p-3">
          {{ t('organization.terms.editingScheduled') }}
        </div>

        <UFormField :label="t('organization.terms.fields.title')">
          <UInput v-model="termTabs[type].title" class="w-full" :disabled="!canManageTerms" />
        </UFormField>

        <UFormField :label="t('organization.terms.fields.content')">
          <MarkdownEditor v-model="termTabs[type].contentMarkdown" :disabled="!canManageTerms" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField :label="t('organization.terms.fields.validFrom')">
            <UInput v-model="termTabs[type].validFrom" type="datetime-local" class="w-full" :disabled="!canManageTerms" />
          </UFormField>
          <UFormField :label="t('organization.terms.fields.isPublic')" :help="t('organization.terms.isPublicHelp')">
            <USwitch v-model="termTabs[type].isPublic" :disabled="!canManageTerms" />
          </UFormField>
        </div>

        <UButton
          color="primary"
          variant="outline"
          icon="i-lucide-save"
          :loading="savingTerm"
          :disabled="!canManageTerms"
          @click="saveTermTab(type)"
        >
          {{ termTabs[type].editingUuid ? t('organization.terms.saveScheduled') : t('organization.terms.publishNew') }}
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

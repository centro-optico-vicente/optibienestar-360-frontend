<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import type { AllyServiceDto, MyAllyDto } from '~/types/allies'

// Partner panel: propose services (POST /v1/aliado/services, born in PROPOSED).
// The backend requires the user to have OWNER/STAFF membership in the given ally.
//
// The ally is resolved from GET /v1/me/allies — never typed. One ally (the common
// case) needs no picker; a user spanning several gets one.
definePageMeta({
  layout: 'dashboard',
  middleware: 'role',
  roles: ['ALIADO'],
})

const { t } = useI18n()

useSeoMeta({ title: () => t('allies.portal.seoTitle') })

const allies = useAllies()
const myAllies = useMyAllies()
const toast = useToast()

// ---- Which ally am I proposing for? ----
const myAllyList = ref<MyAllyDto[]>([])
const alliesLoading = ref(true)

const allyOptions = computed(() => myAllyList.value.map(a => ({ label: a.name, value: a.uuid })))
const selectedAlly = computed(() => myAllyList.value.find(a => a.uuid === state.allyUuid) ?? null)
const hasNoAlly = computed(() => !alliesLoading.value && myAllyList.value.length === 0)

async function loadMyAllies() {
  try {
    myAllyList.value = await myAllies.list()
    // The backend returns primary first, so the head is the sensible default.
    state.allyUuid = myAllyList.value[0]?.uuid ?? ''
  }
  catch {
    // useApi already notified; hasNoAlly renders the empty state.
  }
  finally {
    alliesLoading.value = false
  }
}

// ---- Categories catalog ----
const categoryOptions = ref<{ label: string, value: string }[]>([])

async function loadCategories() {
  try {
    const items = await usePublicCatalog('service-categories').list({ size: '-1' })
    categoryOptions.value = items
      .filter((i: CatalogItem) => i.active !== false)
      .map((i: CatalogItem) => ({ label: i.name, value: i.uuid }))
  }
  catch {
    categoryOptions.value = []
  }
}

onMounted(() => {
  loadMyAllies()
  loadCategories()
})

// ---- Proposal form ----
const isSubmitting = ref(false)
const lastProposed = ref<AllyServiceDto | null>(null)

const state = reactive({
  allyUuid: '',
  serviceCategoryUuid: undefined as string | undefined,
  name: '',
  description: '',
  priceUsd: '',
  discountPct: '',
  requiresAppointment: false,
})

// Locale-reactive schema so validation messages follow the UI locale.
const schema = computed(() => z.object({
  allyUuid: z.string().uuid(t('validation.invalidUuid')),
  serviceCategoryUuid: z.string({ message: t('validation.required') }).min(1, t('validation.required')),
  name: z.string().min(3, t('validation.minChars', { n: 3 })),
  description: z.string().optional(),
  priceUsd: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidAmount')).optional().or(z.literal('')),
  discountPct: z.string().regex(/^\d*(\.\d{1,2})?$/, t('validation.invalidPercent')).optional().or(z.literal('')),
}))

async function onSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  isSubmitting.value = true
  try {
    lastProposed.value = await allies.proposeService({
      allyUuid: state.allyUuid,
      serviceCategoryUuid: state.serviceCategoryUuid!,
      name: state.name,
      description: state.description || undefined,
      priceUsd: state.priceUsd || undefined,
      discountPct: state.discountPct || undefined,
      requiresAppointment: state.requiresAppointment,
    })
    toast.add({
      title: t('allies.portal.proposedToast'),
      description: t('allies.portal.proposedToastDescription'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    // Keep allyUuid for the next proposal; clear the rest.
    state.serviceCategoryUuid = undefined
    state.name = ''
    state.description = ''
    state.priceUsd = ''
    state.discountPct = ''
    state.requiresAppointment = false
  }
  catch {
    // useApi already notified the error (403 if you don't have OWNER/STAFF membership in that ally)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('allies.portal.title') }}</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ t('allies.portal.subtitle') }}
      </p>
    </div>

    <!-- No ally: the form can't produce a valid proposal, so say why instead of
         letting it 403 on submit. -->
    <UAlert
      v-if="hasNoAlly"
      color="warning"
      variant="subtle"
      icon="i-lucide-building-2"
      :title="t('allies.portal.noAllyTitle')"
      :description="t('allies.portal.noAllyDescription')"
    />

    <!-- Last proposal -->
    <UAlert
      v-if="lastProposed"
      color="success"
      variant="subtle"
      icon="i-lucide-clock"
      :title="t('allies.portal.lastProposedTitle', { name: lastProposed.name })"
      :description="t('allies.portal.lastProposedDescription')"
    />

    <!-- Form -->
    <div v-if="!hasNoAlly" class="bg-white rounded-2xl border border-prohealth-100 p-6">
      <h2 class="font-bold text-prohealth-900 mb-1">{{ t('allies.portal.formTitle') }}</h2>
      <p class="text-xs text-prohealth-500 mb-5">
        {{ t('allies.portal.formHint') }}
      </p>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <!-- Ally picker only when there's a real choice to make; otherwise the single
             ally is resolved silently and just shown for confirmation. -->
        <UFormField
          v-if="allyOptions.length > 1"
          :label="t('allies.portal.fields.ally')"
          name="allyUuid"
          required
          :help="t('allies.portal.fields.allyHelp')"
        >
          <USelectMenu
            v-model="state.allyUuid"
            :items="allyOptions"
            label-key="label"
            value-key="value"
            icon="i-lucide-building-2"
            :placeholder="t('common.select')"
            class="w-full"
          />
        </UFormField>
        <p v-else-if="selectedAlly" class="text-xs text-prohealth-500 flex items-center gap-1.5">
          <UIcon name="i-lucide-building-2" class="w-3.5 h-3.5" />
          {{ selectedAlly.name }}
        </p>

        <UFormField :label="t('allies.portal.fields.category')" name="serviceCategoryUuid" required>
          <USelectMenu
            v-model="state.serviceCategoryUuid"
            :items="categoryOptions"
            label-key="label"
            value-key="value"
            :placeholder="t('common.select')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('allies.portal.fields.name')" name="name" required>
          <UInput v-model="state.name" :placeholder="t('allies.portal.namePlaceholder')" class="w-full" />
        </UFormField>

        <UFormField :label="t('allies.portal.fields.description')" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField :label="t('allies.portal.fields.price')" name="priceUsd">
            <UInput v-model="state.priceUsd" placeholder="100.00" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.portal.fields.discount')" name="discountPct">
            <UInput v-model="state.discountPct" placeholder="10.00" class="w-full" />
          </UFormField>
          <UFormField :label="t('allies.portal.fields.requiresAppointment')" name="requiresAppointment">
            <USwitch v-model="state.requiresAppointment" />
          </UFormField>
        </div>

        <div class="flex justify-end pt-2">
          <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-send">
            {{ t('allies.portal.submit') }}
          </UButton>
        </div>
      </UForm>
    </div>

    <!-- Help -->
    <div class="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 text-sm text-prohealth-800 space-y-2">
      <p class="font-semibold flex items-center gap-2">
        <UIcon name="i-lucide-info" class="w-4 h-4 text-cyan-600" />
        {{ t('allies.portal.help.title') }}
      </p>
      <ol class="list-decimal list-inside space-y-1 text-prohealth-700">
        <li>{{ t('allies.portal.help.step1') }}</li>
        <li>{{ t('allies.portal.help.step2') }}</li>
        <li>{{ t('allies.portal.help.step3pre') }}<NuxtLink to="/aliados" class="text-cyan-700 hover:underline">{{ t('allies.portal.help.step3link') }}</NuxtLink>{{ t('allies.portal.help.step3post') }}</li>
      </ol>
    </div>
  </div>
</template>

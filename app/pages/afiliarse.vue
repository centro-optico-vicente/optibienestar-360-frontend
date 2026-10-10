<script setup lang="ts">
// Public self-affiliation — the landing of every promoter QR
// (/afiliarse?ref=<referral code>). POST /v1/public/affiliations creates the
// AFILIADO login, the member attributed to the promoter and the chosen plan's
// membership, which stays suspended until the first payment is approved.
definePageMeta({ layout: 'default' })

interface PublicPlan {
  uuid: string
  name: string
  monthlyFee?: number | string | null
  inscriptionFee?: number | string | null
  currency_Code?: string | null
}

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { formatCurrency } = useFormatters()

useSeoMeta({ title: () => t('affiliationRequest.seoTitle') })

const referralCode = computed(() => String(route.query.ref ?? '').trim().toUpperCase().slice(0, 20))

const plans = ref<PublicPlan[]>([])
onMounted(async () => {
  try {
    const res = await useApi<PublicPlan[] | { content: PublicPlan[] }>('/v1/public/plans', { skipAuth: true })
    plans.value = Array.isArray(res) ? res : res.content ?? []
    if (plans.value.length === 1) state.planUuid = plans.value[0]!.uuid
  }
  catch {
    plans.value = []
  }
})

const planItems = computed(() => plans.value.map(p => ({
  value: p.uuid,
  label: p.monthlyFee != null
    ? `${p.name} · ${formatCurrency(Number(p.monthlyFee), p.currency_Code || 'USD')} / ${t('affiliationRequest.month')}`
    : p.name,
})))
const docTypes = [{ value: 'V', label: 'V' }, { value: 'E', label: 'E' }]

const state = reactive({
  firstName: '', lastName: '', documentType: 'V', documentNumber: '', birthDate: '',
  email: '', phone: '', password: '', passwordConfirm: '', planUuid: '',
})
const sending = ref(false)
const done = ref<{ email: string, promoterName: string | null } | null>(null)

function invalid(): string | null {
  if (!state.firstName.trim() || !state.lastName.trim() || !state.documentNumber.trim() || !state.birthDate || !state.email.trim() || !state.planUuid) {
    return t('affiliationRequest.required')
  }
  if (!/^\d{1,9}$/.test(state.documentNumber.trim())) return t('affiliationRequest.badDocument')
  if (state.password.length < 8) return t('affiliationRequest.shortPassword')
  if (state.password !== state.passwordConfirm) return t('affiliationRequest.passwordMismatch')
  return null
}

async function submit() {
  const error = invalid()
  if (error) {
    toast.add({ title: error, color: 'error' })
    return
  }
  sending.value = true
  try {
    const res = await useApi<{ email: string, promoterName: string | null }>('/v1/public/affiliations', {
      method: 'POST',
      skipAuth: true,
      body: {
        firstName: state.firstName.trim(),
        lastName: state.lastName.trim(),
        documentType: state.documentType,
        documentNumber: state.documentNumber.trim(),
        birthDate: state.birthDate,
        email: state.email.trim(),
        phone: state.phone.trim() || undefined,
        password: state.password,
        planUuid: state.planUuid,
        referralCode: referralCode.value || undefined,
      },
    })
    done.value = res
  }
  catch {
    // useApi already shows the backend's localized error toast
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-xl bg-white rounded-3xl border border-prohealth-100 shadow-sm p-8">
      <template v-if="done">
        <div class="text-center space-y-3">
          <UIcon name="i-lucide-circle-check" class="w-12 h-12 mx-auto text-green-500" />
          <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('affiliationRequest.sentTitle') }}</h1>
          <p class="text-sm text-prohealth-600">{{ t('affiliationRequest.sentBody', { email: done.email }) }}</p>
          <p v-if="done.promoterName" class="text-xs text-prohealth-500">{{ t('affiliationRequest.sentPromoter', { name: done.promoterName }) }}</p>
          <UButton to="/" color="primary" icon="i-lucide-log-in" class="mt-2">{{ t('affiliationRequest.goLogin') }}</UButton>
        </div>
      </template>

      <template v-else>
        <h1 class="text-2xl font-extrabold text-prohealth-900">{{ t('affiliationRequest.title') }}</h1>
        <p class="text-sm text-prohealth-600 mt-1">{{ t('affiliationRequest.subtitle') }}</p>

        <div v-if="referralCode" class="mt-4 rounded-xl bg-cyan-50 border border-cyan-200 px-4 py-3 text-sm text-prohealth-800">
          {{ t('affiliationRequest.referredBy') }} <span class="font-mono font-bold">{{ referralCode }}</span>
        </div>

        <form class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="submit">
          <UFormField :label="t('affiliationRequest.firstName')" required>
            <UInput v-model="state.firstName" class="w-full" maxlength="50" autocomplete="given-name" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.lastName')" required>
            <UInput v-model="state.lastName" class="w-full" maxlength="50" autocomplete="family-name" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.document')" required>
            <div class="flex gap-2">
              <USelect v-model="state.documentType" :items="docTypes" class="w-20" />
              <UInput v-model="state.documentNumber" class="flex-1" maxlength="9" inputmode="numeric" placeholder="12345678" />
            </div>
          </UFormField>
          <UFormField :label="t('affiliationRequest.birthDate')" required>
            <UInput v-model="state.birthDate" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.email')" required>
            <UInput v-model="state.email" type="email" class="w-full" maxlength="254" autocomplete="email" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.phone')">
            <UInput v-model="state.phone" class="w-full" maxlength="30" autocomplete="tel" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.password')" required>
            <UInput v-model="state.password" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.passwordConfirm')" required>
            <UInput v-model="state.passwordConfirm" type="password" class="w-full" maxlength="128" autocomplete="new-password" />
          </UFormField>
          <UFormField :label="t('affiliationRequest.plan')" required class="sm:col-span-2">
            <USelect v-model="state.planUuid" :items="planItems" :placeholder="t('affiliationRequest.planPlaceholder')" class="w-full" />
          </UFormField>
          <p class="sm:col-span-2 text-xs text-prohealth-500">{{ t('affiliationRequest.activationNote') }}</p>
          <UButton type="submit" block color="primary" :loading="sending" icon="i-lucide-user-plus" class="sm:col-span-2">
            {{ t('affiliationRequest.submit') }}
          </UButton>
        </form>
      </template>
    </div>
  </div>
</template>

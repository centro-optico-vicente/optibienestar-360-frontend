<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MembershipCreateRequest, MembershipDto } from '~/types/memberships'
import { toSelectItems } from '~/types/options'
import {
  isMembershipCancelable,
  isMembershipReactivatable,
  membershipStatusColor,
} from '~/types/memberships'

// Self-contained memberships manager for a single member (list + enroll + cancel +
// reactivate). Memberships are a sub-resource of the member, so this card is embedded
// on the member detail page and on the /dashboard/memberships search page. It fetches
// its own data from `memberUuid` and gates each action on its own permission.
const props = defineProps<{ memberUuid: string }>()

const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const { formatCurrency, formatDate } = useFormatters()
const memberships = useMemberships()
const plans = usePlans()
const { can } = usePermissions()
const toast = useToast()

const canView = computed(() => can('MEMBERSHIP_VIEW_ALL'))
const canEnroll = computed(() => can('MEMBERSHIP_CREATE'))
const canCancel = computed(() => can('MEMBERSHIP_CANCEL'))
const canReactivate = computed(() => can('MEMBERSHIP_REACTIVATE'))

// ---- Listing ----
const data = ref<MembershipDto[]>([])
const loading = ref(false)

async function load() {
  if (!props.memberUuid || !canView.value) return
  loading.value = true
  try {
    data.value = await memberships.listForMember(props.memberUuid)
  }
  catch {
    // useApi already shows the error toast
    data.value = []
  }
  finally {
    loading.value = false
  }
}

watch(() => props.memberUuid, load)
onMounted(load)

// ---- Presentation helpers ----
// Amount in USD, formatted in the VE convention. Empty → '—'.
function money(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return t('common.empty')
  return formatCurrency(Number(v), 'USD')
}

// Membership status label; falls back to the raw value.
function statusLabel(s?: string | null): string {
  return s ? t(`memberships.status.${s}`, s) : t('common.empty')
}

// ---- Enroll (modal) ----
const enrollOpen = ref(false)
const enrollSubmitting = ref(false)
const planOptions = ref<{ label: string, value: string }[]>([])
const plansLoaded = ref(false)

async function loadPlans() {
  if (plansLoaded.value) return
  try {
    const res = await plans.options({ limit: 200 })
    planOptions.value = toSelectItems(res)
    plansLoaded.value = true
  }
  catch {
    planOptions.value = []
  }
}

interface EnrollState {
  planUuid: string | undefined
  enrolledAt: string
  expiresAt: string
}

const enrollState = reactive<EnrollState>({
  planUuid: undefined,
  enrolledAt: '',
  expiresAt: '',
})

const enrollSchema = computed(() => z.object({
  planUuid: z.string({ message: t('validation.required') }).min(1, t('memberships.enrollForm.selectPlan')),
  enrolledAt: z.string().optional(),
  expiresAt: z.string().optional(),
}))

async function openEnroll() {
  enrollState.planUuid = undefined
  enrollState.enrolledAt = ''
  enrollState.expiresAt = ''
  enrollOpen.value = true
  await loadPlans()
}

async function onEnrollSubmit(_event: FormSubmitEvent<Record<string, unknown>>) {
  enrollSubmitting.value = true
  try {
    const body: MembershipCreateRequest = {
      planUuid: enrollState.planUuid!,
      enrolledAt: enrollState.enrolledAt || undefined,
      expiresAt: enrollState.expiresAt || undefined,
    }
    await memberships.enroll(props.memberUuid, body)
    toast.add({ title: t('memberships.enrolledToast'), color: 'success', icon: 'i-lucide-check-circle' })
    enrollOpen.value = false
    await load()
    emit('changed')
  }
  catch {
    // useApi already notified the error (422 duplicate active plan, etc.)
  }
  finally {
    enrollSubmitting.value = false
  }
}

// ---- Cancel / reactivate (shared modal) ----
const lifecycleOpen = ref(false)
const lifecycleAction = ref<'cancel' | 'reactivate'>('cancel')
const lifecycleTarget = ref<MembershipDto | null>(null)
const lifecycleReason = ref('')
const lifecycleSubmitting = ref(false)

const isCancel = computed(() => lifecycleAction.value === 'cancel')

function openLifecycle(m: MembershipDto, action: 'cancel' | 'reactivate') {
  lifecycleTarget.value = m
  lifecycleAction.value = action
  lifecycleReason.value = ''
  lifecycleOpen.value = true
}

async function confirmLifecycle() {
  if (!lifecycleTarget.value) return
  lifecycleSubmitting.value = true
  const reason = lifecycleReason.value.trim() || undefined
  try {
    if (isCancel.value) await memberships.cancel(lifecycleTarget.value.uuid, reason)
    else await memberships.reactivate(lifecycleTarget.value.uuid, reason)
    toast.add({
      title: isCancel.value ? t('memberships.canceledToast') : t('memberships.reactivatedToast'),
      color: isCancel.value ? 'warning' : 'success',
      icon: isCancel.value ? 'i-lucide-circle-x' : 'i-lucide-circle-check',
    })
    lifecycleOpen.value = false
    await load()
    emit('changed')
  }
  catch {
    // useApi already notified the error (422 invalid transition, etc.)
  }
  finally {
    lifecycleSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="canView" class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
    <div class="flex items-center justify-between px-6 py-4 border-b border-prohealth-100">
      <div>
        <h2 class="font-bold text-prohealth-900">{{ t('memberships.title') }}</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">{{ t('memberships.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <UTooltip :text="canEnroll ? t('memberships.enrollTooltip') : t('memberships.noPermissionEnroll')">
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-badge-plus"
            size="sm"
            :disabled="!canEnroll"
            @click="openEnroll"
          >
            {{ t('memberships.enroll') }}
          </UButton>
        </UTooltip>
        <RefreshButton
          :loading="loading"
          :title="t('common.refreshSection')"
          @refresh="load"
        />
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">{{ t('memberships.columns.plan') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('memberships.columns.monthly') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('memberships.columns.status') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('memberships.columns.enrolledAt') }}</th>
            <th class="px-6 py-3 font-semibold">{{ t('memberships.columns.nextDue') }}</th>
            <th class="px-6 py-3 font-semibold text-right">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="2" :cols="6" />
          <tr v-else-if="data.length === 0">
            <td colspan="6" class="px-6 py-10 text-center text-prohealth-500">
              <UIcon name="i-lucide-badge-check" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
              {{ t('memberships.empty') }}
            </td>
          </tr>
          <tr v-for="m in data" v-else :key="m.uuid" class="hover:bg-prohealth-50/50">
            <td class="px-6 py-3">
              <div class="font-semibold text-prohealth-900">{{ m.planName || t('common.empty') }}</div>
              <div class="text-xs text-prohealth-500 font-mono">{{ m.planCode }}</div>
            </td>
            <td class="px-6 py-3 text-prohealth-700">{{ money(m.monthlyFee) }}</td>
            <td class="px-6 py-3">
              <UBadge :color="membershipStatusColor(m.status)" variant="subtle" size="sm">
                {{ statusLabel(m.status) }}
              </UBadge>
            </td>
            <td class="px-6 py-3 text-prohealth-600">{{ formatDate(m.enrolledAt, 'short') }}</td>
            <td class="px-6 py-3 text-prohealth-600">{{ formatDate(m.nextDueDate, 'short') }}</td>
            <td class="px-6 py-3">
              <div class="flex items-center justify-end gap-1">
                <UTooltip
                  v-if="isMembershipCancelable(m.status)"
                  :text="canCancel ? t('memberships.cancelTooltip') : t('memberships.noPermissionCancel')"
                >
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-circle-x"
                    size="sm"
                    :disabled="!canCancel"
                    @click="openLifecycle(m, 'cancel')"
                  />
                </UTooltip>
                <UTooltip
                  v-if="isMembershipReactivatable(m.status)"
                  :text="canReactivate ? t('memberships.reactivateTooltip') : t('memberships.noPermissionReactivate')"
                >
                  <UButton
                    color="success"
                    variant="ghost"
                    icon="i-lucide-circle-check"
                    size="sm"
                    :disabled="!canReactivate"
                    @click="openLifecycle(m, 'reactivate')"
                  />
                </UTooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Enroll modal -->
    <UModal
      v-model:open="enrollOpen"
      :title="t('memberships.enrollForm.title')"
      :description="t('memberships.enrollForm.description')"
    >
      <template #body>
        <UForm :schema="enrollSchema" :state="enrollState" class="space-y-4" @submit="onEnrollSubmit">
          <UFormField :label="t('memberships.enrollForm.plan')" name="planUuid" required :help="t('memberships.enrollForm.planHelp')">
            <USelectMenu
              v-model="enrollState.planUuid"
              :items="planOptions"
              label-key="label"
              value-key="value"
              :placeholder="t('memberships.enrollForm.selectPlan')"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField :label="t('memberships.enrollForm.enrolledAt')" name="enrolledAt" :help="t('memberships.enrollForm.enrolledAtHelp')">
              <UInput v-model="enrollState.enrolledAt" type="date" class="w-full" />
            </UFormField>
            <UFormField :label="t('memberships.enrollForm.expiresAt')" name="expiresAt" :help="t('memberships.enrollForm.expiresAtHelp')">
              <UInput v-model="enrollState.expiresAt" type="date" class="w-full" />
            </UFormField>
          </div>

          <div class="flex items-center justify-between gap-3 pt-2">
            <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>
            <div class="flex items-center gap-3">
              <UButton color="neutral" variant="ghost" :disabled="enrollSubmitting" @click="enrollOpen = false">
                {{ t('common.cancel') }}
              </UButton>
              <UButton type="submit" color="primary" :loading="enrollSubmitting" icon="i-lucide-save">
                {{ t('memberships.enrollForm.submit') }}
              </UButton>
            </div>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Cancel / reactivate modal -->
    <UModal
      v-model:open="lifecycleOpen"
      :title="isCancel ? t('memberships.lifecycle.cancelTitle') : t('memberships.lifecycle.reactivateTitle')"
    >
      <template #body>
        <div class="space-y-4">
          <div v-if="lifecycleTarget" class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-prohealth-500">{{ t('memberships.lifecycle.plan') }}</span>
              <span class="font-semibold text-prohealth-900">
                {{ lifecycleTarget.planName }} <span class="font-mono text-prohealth-500">({{ lifecycleTarget.planCode }})</span>
              </span>
            </div>
          </div>

          <p class="text-sm text-prohealth-700">
            <i18n-t v-if="isCancel" keypath="memberships.lifecycle.cancelNotice" tag="span" scope="global">
              <template #status>
                <span class="font-semibold text-red-700">{{ t('memberships.lifecycle.canceledWord') }}</span>
              </template>
            </i18n-t>
            <i18n-t v-else keypath="memberships.lifecycle.reactivateNotice" tag="span" scope="global">
              <template #status>
                <span class="font-semibold text-green-700">{{ t('memberships.lifecycle.activeWord') }}</span>
              </template>
            </i18n-t>
          </p>

          <UFormField :label="t('memberships.lifecycle.reasonLabel')" :help="t('memberships.lifecycle.reasonHelp')">
            <UTextarea
              v-model="lifecycleReason"
              :rows="2"
              :maxlength="500"
              :placeholder="isCancel ? t('memberships.lifecycle.placeholderCancel') : t('memberships.lifecycle.placeholderReactivate')"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="lifecycleSubmitting" @click="lifecycleOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              :color="isCancel ? 'error' : 'success'"
              :icon="isCancel ? 'i-lucide-circle-x' : 'i-lucide-circle-check'"
              :loading="lifecycleSubmitting"
              @click="confirmLifecycle"
            >
              {{ isCancel ? t('memberships.lifecycle.cancelButton') : t('memberships.lifecycle.reactivateButton') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

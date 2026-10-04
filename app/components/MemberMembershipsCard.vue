<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MembershipCreateRequest, MembershipDto } from '~/types/memberships'
import type { MembershipPromotionDto, PromotionDto } from '~/types/promotions'
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
const promotionsApi = usePromotions()
const { can } = usePermissions()
const toast = useToast()

const canView = computed(() => can('MEMBERSHIP_VIEW_ALL'))
const canViewPlan = computed(() => can('PLAN_VIEW_ALL'))
const canEnroll = computed(() => can('MEMBERSHIP_CREATE'))
const canCancel = computed(() => can('MEMBERSHIP_CANCEL'))
const canReactivate = computed(() => can('MEMBERSHIP_REACTIVATE'))
const canExceptionCreate = computed(() => can('CAMPAIGN_EXCEPTION_CREATE'))
const canAssignPromotion = computed(() => can('PROMOTION_ASSIGN'))

// ---- Campaign exception (Part G): row action to include/exclude a membership ----
const exceptionOpen = ref(false)
const exceptionMembership = ref<MembershipDto | null>(null)
function openExceptionModal(m: MembershipDto) {
  exceptionMembership.value = m
  exceptionOpen.value = true
}

// ---- Listing ----
const data = ref<MembershipDto[]>([])
const loading = ref(false)

async function load() {
  if (!props.memberUuid || !canView.value) return
  loading.value = true
  try {
    data.value = await memberships.listForMember(props.memberUuid)
    await loadPromotions()
  }
  catch {
    // useApi already shows the error toast
    data.value = []
  }
  finally {
    loading.value = false
  }
}

// ---- Promotion of each live membership (hub ADR 0018) ----
const promotionByMembership = ref<Record<string, MembershipPromotionDto>>({})

async function loadPromotions() {
  const live = data.value.filter(m => m.status !== 'CANCELED')
  const entries = await Promise.all(live.map(async (m) => {
    try {
      const res = await promotionsApi.currentForMembership(m.uuid)
      return res.exists && res.promotion ? [m.uuid, res.promotion] as const : null
    }
    catch {
      return null
    }
  }))
  promotionByMembership.value = Object.fromEntries(entries.filter((e): e is readonly [string, MembershipPromotionDto] => e !== null))
}

function promotionSummary(p: MembershipPromotionDto): string {
  const pct = p.discountPct_Display ?? `${Number(p.discountPct)}%`
  const left = p.cyclesRemaining != null ? ` · ${t('promotions.membership.cyclesLeft', { n: p.cyclesRemaining })}` : ''
  return `${p.promotion_Display ?? ''} · ${pct}${left}`
}

// Apply a promotion to an existing membership, or cancel the current one.
const assignOpen = ref(false)
const assignTarget = ref<MembershipDto | null>(null)
const assignOptions = ref<PromotionDto[]>([])
const assignPromotionUuid = ref<string | undefined>(undefined)
const assignCode = ref('')
const assignSubmitting = ref(false)
const assignSelected = computed(() => assignOptions.value.find(p => p.uuid === assignPromotionUuid.value) ?? null)

async function openAssign(m: MembershipDto) {
  assignTarget.value = m
  assignPromotionUuid.value = undefined
  assignCode.value = ''
  assignOptions.value = []
  assignOpen.value = true
  try {
    assignOptions.value = await promotionsApi.optionsForMembership(m.uuid)
  }
  catch {
    assignOptions.value = []
  }
}

async function confirmAssign() {
  if (!assignTarget.value || !assignPromotionUuid.value) return
  assignSubmitting.value = true
  try {
    await promotionsApi.assign(assignTarget.value.uuid, {
      promotionUuid: assignPromotionUuid.value,
      code: assignCode.value.trim() || undefined,
    })
    toast.add({ title: t('promotions.membership.assignedToast'), color: 'success', icon: 'i-lucide-badge-percent' })
    assignOpen.value = false
    await load()
  }
  catch {
    // useApi already notified (not eligible, code invalid, cap reached…)
  }
  finally {
    assignSubmitting.value = false
  }
}

const cancelPromoOpen = ref(false)
const cancelPromoTarget = ref<MembershipDto | null>(null)
const cancelPromoReason = ref('')
const cancelPromoSubmitting = ref(false)

function openCancelPromotion(m: MembershipDto) {
  cancelPromoTarget.value = m
  cancelPromoReason.value = ''
  cancelPromoOpen.value = true
}

async function confirmCancelPromotion() {
  if (!cancelPromoTarget.value || !cancelPromoReason.value.trim()) return
  cancelPromoSubmitting.value = true
  try {
    await promotionsApi.cancel(cancelPromoTarget.value.uuid, cancelPromoReason.value.trim())
    toast.add({ title: t('promotions.membership.canceledToast'), color: 'warning', icon: 'i-lucide-circle-x' })
    cancelPromoOpen.value = false
    await load()
  }
  catch {
    // useApi already notified
  }
  finally {
    cancelPromoSubmitting.value = false
  }
}

function acceptsCode(p: PromotionDto | null): boolean {
  return !!p && (p.requiresCode || p.acceptsPromoterCode || p.acceptsMemberCode || p.acceptsAllyCode)
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
// Save button lives in the modal's #footer slot, outside the <UForm> element,
// so it can't use type="submit"; it triggers validation via this instead.
const enrollFormRef = ref<{ submit: () => Promise<void> } | null>(null)
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
  promotionUuid: string | undefined
  promotionCode: string
}

const enrollState = reactive<EnrollState>({
  planUuid: undefined,
  enrolledAt: '',
  expiresAt: '',
  promotionUuid: undefined,
  promotionCode: '',
})

// Promotions offered for the chosen plan (ACQUISITION, campaign running, cap available).
const enrollPromotions = ref<PromotionDto[]>([])
const enrollPromotion = computed(() => enrollPromotions.value.find(p => p.uuid === enrollState.promotionUuid) ?? null)
watch(() => enrollState.planUuid, async (planUuid) => {
  enrollState.promotionUuid = undefined
  enrollState.promotionCode = ''
  enrollPromotions.value = []
  if (!planUuid) return
  try {
    enrollPromotions.value = await promotionsApi.offeredForEnrollment(planUuid)
  }
  catch {
    enrollPromotions.value = []
  }
})

const enrollSchema = computed(() => z.object({
  planUuid: z.string({ message: t('validation.required') }).min(1, t('memberships.enrollForm.selectPlan')),
  enrolledAt: z.string().optional(),
  expiresAt: z.string().optional(),
  promotionUuid: z.string().optional(),
  promotionCode: enrollPromotion.value?.requiresCode
    ? z.string().trim().min(1, t('promotions.membership.codeRequired'))
    : z.string().optional(),
}))

async function openEnroll() {
  enrollState.planUuid = undefined
  enrollState.enrolledAt = ''
  enrollState.expiresAt = ''
  enrollState.promotionUuid = undefined
  enrollState.promotionCode = ''
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
      promotionUuid: enrollState.promotionUuid || undefined,
      promotionCode: enrollState.promotionCode.trim() || undefined,
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
              <div class="font-semibold">
                <CommonEntityLinkCell
                  :to="m.planUuid ? `/dashboard/plans/${m.planUuid}` : null"
                  :label="m.planName"
                  :can="canViewPlan"
                />
              </div>
              <div class="text-xs text-prohealth-500 font-mono">{{ m.planCode }}</div>
              <UBadge
                v-if="promotionByMembership[m.uuid]"
                color="primary"
                variant="subtle"
                size="sm"
                icon="i-lucide-badge-percent"
                class="mt-1"
                :title="promotionByMembership[m.uuid]!.codeUsed ? t('promotions.membership.viaCode', { code: promotionByMembership[m.uuid]!.codeUsed, owner: promotionByMembership[m.uuid]!.codeOwner_Display ?? '' }) : undefined"
              >
                {{ promotionSummary(promotionByMembership[m.uuid]!) }}
              </UBadge>
            </td>
            <td class="px-6 py-3 text-prohealth-700">{{ money(m.monthlyFee) }}</td>
            <td class="px-6 py-3">
              <UBadge :color="membershipStatusColor(m.status)" variant="subtle" size="sm">
                {{ m.status_Display ?? statusLabel(m.status) }}
              </UBadge>
            </td>
            <td class="px-6 py-3 text-prohealth-600">{{ m.enrolledAt_Display ?? formatDate(m.enrolledAt, 'short') }}</td>
            <td class="px-6 py-3 text-prohealth-600">{{ m.nextDueDate_Display ?? formatDate(m.nextDueDate, 'short') }}</td>
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
                <template v-if="canAssignPromotion && m.status !== 'CANCELED'">
                  <UTooltip v-if="promotionByMembership[m.uuid]" :text="t('promotions.membership.cancelTooltip')">
                    <UButton color="warning" variant="ghost" icon="i-lucide-badge-x" size="sm" @click="openCancelPromotion(m)" />
                  </UTooltip>
                  <UTooltip v-else :text="t('promotions.membership.assignTooltip')">
                    <UButton color="primary" variant="ghost" icon="i-lucide-badge-percent" size="sm" @click="openAssign(m)" />
                  </UTooltip>
                </template>
                <UTooltip v-if="canExceptionCreate" :text="t('campaigns.exceptions.addRowTooltip')">
                  <UButton color="neutral" variant="ghost" icon="i-lucide-rocket" size="sm" @click="openExceptionModal(m)" />
                </UTooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CampaignExceptionFormModal
      v-model:open="exceptionOpen"
      :membership-uuid="exceptionMembership?.uuid"
      :membership-display="exceptionMembership?.planName"
    />

    <!-- Enroll modal -->
    <UModal
      v-model:open="enrollOpen"
      :title="t('memberships.enrollForm.title')"
      :description="t('memberships.enrollForm.description')"
    >
      <template #body>
        <UForm ref="enrollFormRef" :schema="enrollSchema" :state="enrollState" class="space-y-4" @submit="onEnrollSubmit">
          <UFormField :label="t('memberships.enrollForm.plan')" name="planUuid" required :help="t('memberships.enrollForm.planHelp')">
            <USelectMenu
              clear
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

          <UFormField
            v-if="enrollPromotions.length"
            :label="t('promotions.membership.promotion')"
            name="promotionUuid"
            :help="enrollPromotion?.description || t('promotions.membership.promotionHelp')"
          >
            <USelectMenu
              clear
              v-model="enrollState.promotionUuid"
              :items="enrollPromotions"
              label-key="name"
              value-key="uuid"
              :placeholder="t('promotions.membership.noPromotion')"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="acceptsCode(enrollPromotion)"
            :label="t('promotions.membership.code')"
            name="promotionCode"
            :required="enrollPromotion?.requiresCode"
            :help="t('promotions.membership.codeHelp')"
          >
            <UInput v-model="enrollState.promotionCode" icon="i-lucide-ticket" class="w-full font-mono uppercase" />
          </UFormField>
        </UForm>
      </template>

      <template #footer>
        <div class="w-full space-y-2">
          <p class="text-xs text-prohealth-500">{{ t('common.requiredFieldsHint') }}</p>

          <div class="flex items-center justify-end gap-3">
            <UButton color="neutral" variant="ghost" :disabled="enrollSubmitting" @click="enrollOpen = false">
              {{ t('common.cancel') }}
            </UButton>
            <UButton color="primary" variant="outline" :loading="enrollSubmitting" icon="i-lucide-save" @click="enrollFormRef?.submit()">
              {{ t('memberships.enrollForm.submit') }}
            </UButton>
          </div>
        </div>
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

    <!-- Apply promotion to an existing membership -->
    <UModal v-model:open="assignOpen" :title="t('promotions.membership.assignTitle')">
      <template #body>
        <div class="space-y-4">
          <p v-if="!assignOptions.length" class="text-sm text-prohealth-500">{{ t('promotions.membership.noOptions') }}</p>
          <template v-else>
            <UFormField :label="t('promotions.membership.promotion')" required :help="assignSelected?.description || undefined">
              <USelectMenu
                v-model="assignPromotionUuid"
                :items="assignOptions"
                label-key="name"
                value-key="uuid"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="acceptsCode(assignSelected)"
              :label="t('promotions.membership.code')"
              :required="assignSelected?.requiresCode"
              :help="t('promotions.membership.codeHelp')"
            >
              <UInput v-model="assignCode" icon="i-lucide-ticket" class="w-full font-mono uppercase" />
            </UFormField>
          </template>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="assignSubmitting" @click="assignOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton
              color="primary"
              icon="i-lucide-badge-percent"
              :loading="assignSubmitting"
              :disabled="!assignPromotionUuid || (assignSelected?.requiresCode && !assignCode.trim())"
              @click="confirmAssign"
            >
              {{ t('promotions.membership.assign') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Cancel the current promotion -->
    <UModal v-model:open="cancelPromoOpen" :title="t('promotions.membership.cancelTitle')">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-prohealth-700">{{ t('promotions.membership.cancelNotice') }}</p>
          <UFormField :label="t('promotions.membership.reason')" required>
            <UTextarea v-model="cancelPromoReason" :rows="2" :maxlength="500" class="w-full" />
          </UFormField>
          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="cancelPromoSubmitting" @click="cancelPromoOpen = false">{{ t('common.cancel') }}</UButton>
            <UButton color="warning" icon="i-lucide-badge-x" :loading="cancelPromoSubmitting" :disabled="!cancelPromoReason.trim()" @click="confirmCancelPromotion">
              {{ t('promotions.membership.cancelButton') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { MembershipCreateRequest, MembershipDto } from '~/types/memberships'
import type { PlanDto } from '~/types/plans'
import {
  isMembershipCancelable,
  isMembershipReactivatable,
  membershipStatusColor,
  membershipStatusLabel,
} from '~/types/memberships'

// Self-contained memberships manager for a single member (list + enroll + cancel +
// reactivate). Memberships are a sub-resource of the member, so this card is embedded
// on the member detail page and on the /dashboard/memberships search page. It fetches
// its own data from `memberUuid` and gates each action on its own permission.
const props = defineProps<{ memberUuid: string }>()

const emit = defineEmits<{ changed: [] }>()

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
function formatMoney(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return `$${Number(v).toFixed(2)}`
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}

// ---- Enroll (modal) ----
const enrollOpen = ref(false)
const enrollSubmitting = ref(false)
const planOptions = ref<{ label: string, value: string }[]>([])
const plansLoaded = ref(false)

async function loadPlans() {
  if (plansLoaded.value) return
  try {
    const res = await plans.list({ size: 100, sort: 'code,asc' })
    planOptions.value = (res.content ?? []).map((p: PlanDto) => ({
      label: `${p.code} — ${p.name}`,
      value: p.uuid,
    }))
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

const enrollSchema = z.object({
  planUuid: z.string({ message: 'Requerido' }).min(1, 'Selecciona un plan'),
  enrolledAt: z.string().optional(),
  expiresAt: z.string().optional(),
})

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
    toast.add({ title: 'Afiliación creada', color: 'success', icon: 'i-lucide-check-circle' })
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
      title: isCancel.value ? 'Afiliación cancelada' : 'Afiliación reactivada',
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
        <h2 class="font-bold text-prohealth-900">Membresías</h2>
        <p class="text-xs text-prohealth-500 mt-0.5">Afiliaciones a planes: vigencia, estado y pagos.</p>
      </div>
      <UTooltip :text="canEnroll ? 'Afiliar a un plan' : 'No tienes permiso para afiliar'">
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-badge-plus"
          size="sm"
          :disabled="!canEnroll"
          @click="openEnroll"
        >
          Afiliar a un plan
        </UButton>
      </UTooltip>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
            <th class="px-6 py-3 font-semibold">Plan</th>
            <th class="px-6 py-3 font-semibold">Mensualidad</th>
            <th class="px-6 py-3 font-semibold">Estado</th>
            <th class="px-6 py-3 font-semibold">Afiliado desde</th>
            <th class="px-6 py-3 font-semibold">Próx. pago</th>
            <th class="px-6 py-3 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-prohealth-100">
          <TableSkeleton v-if="loading" :rows="2" :cols="6" />
          <tr v-else-if="data.length === 0">
            <td colspan="6" class="px-6 py-10 text-center text-prohealth-500">
              <UIcon name="i-lucide-badge-check" class="w-7 h-7 mx-auto mb-2 text-prohealth-300" />
              Sin membresías. Afilia a este titular a un plan.
            </td>
          </tr>
          <tr v-for="m in data" v-else :key="m.uuid" class="hover:bg-prohealth-50/50">
            <td class="px-6 py-3">
              <div class="font-semibold text-prohealth-900">{{ m.planName || '—' }}</div>
              <div class="text-xs text-prohealth-500 font-mono">{{ m.planCode }}</div>
            </td>
            <td class="px-6 py-3 text-prohealth-700">{{ formatMoney(m.monthlyFee) }}</td>
            <td class="px-6 py-3">
              <UBadge :color="membershipStatusColor(m.status)" variant="subtle" size="sm">
                {{ membershipStatusLabel(m.status) }}
              </UBadge>
            </td>
            <td class="px-6 py-3 text-prohealth-600">{{ formatDate(m.enrolledAt) }}</td>
            <td class="px-6 py-3 text-prohealth-600">{{ formatDate(m.nextDueDate) }}</td>
            <td class="px-6 py-3">
              <div class="flex items-center justify-end gap-1">
                <UTooltip
                  v-if="isMembershipCancelable(m.status)"
                  :text="canCancel ? 'Cancelar afiliación' : 'No tienes permiso para cancelar'"
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
                  :text="canReactivate ? 'Reactivar afiliación' : 'No tienes permiso para reactivar'"
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
      title="Afiliar a un plan"
      description="Crea una nueva membresía. El pricing se copia del plan al momento de afiliar."
    >
      <template #body>
        <UForm :schema="enrollSchema" :state="enrollState" class="space-y-4" @submit="onEnrollSubmit">
          <UFormField label="Plan" name="planUuid" required help="La mensualidad e inscripción se toman del plan.">
            <USelectMenu
              v-model="enrollState.planUuid"
              :items="planOptions"
              label-key="label"
              value-key="value"
              placeholder="Selecciona un plan"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Afiliado desde" name="enrolledAt" help="Vacío = hoy.">
              <UInput v-model="enrollState.enrolledAt" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Vence (opcional)" name="expiresAt" help="Fecha de expiración forzada.">
              <UInput v-model="enrollState.expiresAt" type="date" class="w-full" />
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton color="neutral" variant="ghost" :disabled="enrollSubmitting" @click="enrollOpen = false">
              Cancelar
            </UButton>
            <UButton type="submit" color="primary" :loading="enrollSubmitting" icon="i-lucide-save">
              Afiliar
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Cancel / reactivate modal -->
    <UModal
      v-model:open="lifecycleOpen"
      :title="isCancel ? 'Cancelar afiliación' : 'Reactivar afiliación'"
    >
      <template #body>
        <div class="space-y-4">
          <div v-if="lifecycleTarget" class="rounded-xl border border-prohealth-100 bg-prohealth-50/40 p-4 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-prohealth-500">Plan</span>
              <span class="font-semibold text-prohealth-900">
                {{ lifecycleTarget.planName }} <span class="font-mono text-prohealth-500">({{ lifecycleTarget.planCode }})</span>
              </span>
            </div>
          </div>

          <p class="text-sm text-prohealth-700">
            <template v-if="isCancel">
              La membresía pasará a <span class="font-semibold text-red-700">cancelada</span> y el titular perderá la cobertura.
            </template>
            <template v-else>
              La membresía volverá a <span class="font-semibold text-green-700">activa</span>.
            </template>
          </p>

          <UFormField label="Motivo (opcional)" help="Queda registrado en el historial de la membresía.">
            <UTextarea
              v-model="lifecycleReason"
              :rows="2"
              :maxlength="500"
              :placeholder="isCancel ? 'Ej. falta de pago, solicitud del titular…' : 'Ej. regularizó el pago…'"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-3 pt-1">
            <UButton color="neutral" variant="ghost" :disabled="lifecycleSubmitting" @click="lifecycleOpen = false">
              Cancelar
            </UButton>
            <UButton
              :color="isCancel ? 'error' : 'success'"
              :icon="isCancel ? 'i-lucide-circle-x' : 'i-lucide-circle-check'"
              :loading="lifecycleSubmitting"
              @click="confirmLifecycle"
            >
              {{ isCancel ? 'Cancelar afiliación' : 'Reactivar afiliación' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

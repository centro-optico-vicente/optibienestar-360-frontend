<script setup lang="ts">
import type { ApiError } from '~/types/auth'
import type { PlanDto } from '~/types/plans'
import { planTypeLabel } from '~/types/plans'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PLAN_VIEW_ALL',
})

useSeoMeta({ title: 'Detalle de plan — OptiSalud Plus' })

const route = useRoute()
const planUuid = route.params.uuid as string

const plans = usePlans()
const { can } = usePermissions()
const toast = useToast()

const canUpdate = computed(() => can('PLAN_UPDATE'))
const canDelete = computed(() => can('PLAN_DELETE'))

// ---- Carga del plan ----
const plan = ref<PlanDto | null>(null)
const loading = ref(true)
const notFound = ref(false)

async function loadPlan() {
  loading.value = true
  try {
    plan.value = await plans.get(planUuid)
  }
  catch (err) {
    if ((err as ApiError).status === 404) notFound.value = true
    plan.value = null
  }
  finally {
    loading.value = false
  }
}

onMounted(loadPlan)

function formatMoney(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return `$${Number(v).toFixed(2)}`
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es', { dateStyle: 'medium' })
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

// ---- Editar (modal compartido) ----
const formOpen = ref(false)

function openEdit() {
  formOpen.value = true
}

function onSaved(updated: PlanDto) {
  plan.value = updated
}

// ---- Publicar / despublicar (PATCH de un solo campo) ----
const togglingPublish = ref(false)

async function togglePublish() {
  if (!plan.value) return
  togglingPublish.value = true
  const next = !plan.value.published
  try {
    plan.value = await plans.update(plan.value.uuid, { published: next })
    toast.add({
      title: next ? 'Plan publicado' : 'Plan despublicado',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  }
  catch {
    // toast por useApi
  }
  finally {
    togglingPublish.value = false
  }
}

// ---- Eliminar ----
const deleteOpen = ref(false)
const deleting = ref(false)

async function confirmDelete() {
  if (!plan.value) return
  deleting.value = true
  try {
    await plans.remove(plan.value.uuid)
    toast.add({ title: 'Plan eliminado', color: 'success', icon: 'i-lucide-check-circle' })
    await navigateTo('/dashboard/plans')
  }
  catch {
    // toast por useApi
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- Volver -->
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-arrow-left"
      to="/dashboard/plans"
      size="sm"
    >
      Planes
    </UButton>

    <!-- Cargando -->
    <div v-if="loading" class="bg-white rounded-2xl border border-prohealth-100 p-6 space-y-3">
      <USkeleton class="h-7 w-64 rounded" />
      <USkeleton class="h-4 w-40 rounded" />
      <USkeleton class="h-4 w-full max-w-lg rounded" />
    </div>

    <!-- No encontrado -->
    <div v-else-if="notFound || !plan" class="bg-white rounded-2xl border border-prohealth-100 p-12 text-center">
      <UIcon name="i-lucide-search-x" class="w-10 h-10 mx-auto mb-3 text-prohealth-300" />
      <p class="text-prohealth-700 font-semibold">Plan no encontrado</p>
      <p class="text-sm text-prohealth-500 mt-1">El registro no existe o fue eliminado.</p>
    </div>

    <template v-else>
      <!-- Encabezado + acciones -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-extrabold text-prohealth-900">{{ plan.name }}</h1>
              <UBadge color="primary" variant="subtle">{{ planTypeLabel(plan.type) }}</UBadge>
              <UBadge :color="plan.published ? 'success' : 'neutral'" variant="subtle">
                {{ plan.published ? 'Publicado' : 'Borrador' }}
              </UBadge>
              <UBadge v-if="plan.status" :color="plan.status === 'ACTIVE' ? 'success' : 'warning'" variant="subtle">
                {{ plan.status }}
              </UBadge>
            </div>
            <p class="text-sm text-prohealth-500 mt-1 font-mono">{{ plan.code }}</p>
          </div>

          <div class="flex items-center gap-2">
            <UTooltip :text="canUpdate ? (plan.published ? 'Retirar del directorio' : 'Publicar en el directorio') : 'No tienes permiso para editar'">
              <UButton
                :color="plan.published ? 'neutral' : 'primary'"
                variant="soft"
                :icon="plan.published ? 'i-lucide-eye-off' : 'i-lucide-globe'"
                :loading="togglingPublish"
                :disabled="!canUpdate"
                @click="togglePublish"
              >
                {{ plan.published ? 'Despublicar' : 'Publicar' }}
              </UButton>
            </UTooltip>
            <UTooltip :text="canUpdate ? 'Editar plan' : 'No tienes permiso para editar'">
              <UButton
                color="primary"
                icon="i-lucide-pencil"
                :disabled="!canUpdate"
                @click="openEdit"
              >
                Editar
              </UButton>
            </UTooltip>
            <UTooltip :text="canDelete ? 'Eliminar plan' : 'No tienes permiso para eliminar'">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :disabled="!canDelete"
                @click="deleteOpen = true"
              />
            </UTooltip>
          </div>
        </div>

        <p v-if="plan.description" class="text-sm text-prohealth-700 mt-4 max-w-3xl">
          {{ plan.description }}
        </p>
      </div>

      <!-- Pricing -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Pricing</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Inscripción</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ formatMoney(plan.inscriptionFee) }}</dd>
            <dd class="text-xs text-prohealth-500">Cargo único de afiliación.</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Mensualidad</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">{{ formatMoney(plan.monthlyFee) }}</dd>
            <dd class="text-xs text-prohealth-500">Cargo recurrente mensual.</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Inscripción beneficiario extra</dt>
            <dd class="text-prohealth-900 text-lg font-semibold mt-0.5">
              {{ plan.extraBeneficiaryInscriptionFee != null ? formatMoney(plan.extraBeneficiaryInscriptionFee) : 'No admite' }}
            </dd>
            <dd class="text-xs text-prohealth-500">Cargo único por beneficiario adicional.</dd>
          </div>
        </dl>
      </div>

      <!-- Beneficiarios y vigencia -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Beneficiarios y vigencia</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Beneficiarios incluidos</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ plan.includedBeneficiaries }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Beneficiarios máximos</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ plan.maxBeneficiaries ?? 'Sin tope' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Días de gracia</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ plan.gracePeriodDays }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Publicado el</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDate(plan.publishedAt) }}</dd>
          </div>
        </dl>
      </div>

      <!-- Metadatos -->
      <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
        <h2 class="font-bold text-prohealth-900 mb-4">Metadatos</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Creado</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDateTime(plan.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">Última actualización</dt>
            <dd class="text-prohealth-800 mt-0.5">{{ formatDateTime(plan.updatedAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-prohealth-400 font-semibold">UUID</dt>
            <dd class="text-prohealth-800 mt-0.5 font-mono text-xs break-all">{{ plan.uuid }}</dd>
          </div>
        </dl>
      </div>
    </template>

    <!-- Modal editar (compartido con la lista) -->
    <PlanFormModal v-model:open="formOpen" :plan="plan" @saved="onSaved" />

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" title="Eliminar plan">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar el plan
          <span class="font-semibold">{{ plan?.name }}</span>?
          Esta acción lo desactiva y lo retira del directorio (soft-delete).
          Las membresías existentes conservan su pricing (no se ven afectadas).
        </p>
        <div class="flex items-center justify-end gap-3 pt-5">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="deleteOpen = false">
            Cancelar
          </UButton>
          <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">
            Eliminar
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

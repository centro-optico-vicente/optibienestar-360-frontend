<script setup lang="ts">
import type { PlanDto } from '~/types/plans'
import { planTypeLabel } from '~/types/plans'

definePageMeta({
  layout: 'dashboard',
  middleware: 'can',
  permission: 'PLAN_VIEW_ALL',
})

useSeoMeta({ title: 'Planes — OptiSalud Plus' })

const plans = usePlans()
const { can } = usePermissions()
const toast = useToast()

const canCreate = computed(() => can('PLAN_CREATE'))
const canUpdate = computed(() => can('PLAN_UPDATE'))
const canDelete = computed(() => can('PLAN_DELETE'))

// ---- Listado + paginación + búsqueda ----
const data = ref<PlanDto[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1) // UPagination es 1-based; la API es 0-based
const size = ref(20)
const search = ref('')

async function load() {
  loading.value = true
  try {
    const res = await plans.list({
      page: page.value - 1,
      size: size.value,
      sort: 'code,asc',
      q: search.value.trim() || undefined,
    })
    data.value = res.content ?? []
    total.value = res.totalElements ?? 0
  }
  catch {
    // useApi ya muestra el toast del error
    data.value = []
    total.value = 0
  }
  finally {
    loading.value = false
  }
}

watch([page, size], load)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 400)
})

onMounted(load)

function formatMoney(v?: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return `$${Number(v).toFixed(2)}`
}

// ---- Crear/editar (modal compartido) ----
const formOpen = ref(false)
const editingPlan = ref<PlanDto | null>(null)

function openCreate() {
  editingPlan.value = null
  formOpen.value = true
}

function openEdit(p: PlanDto) {
  editingPlan.value = p
  formOpen.value = true
}

async function onSaved() {
  await load()
}

// ---- Eliminar ----
const deleteOpen = ref(false)
const deleting = ref(false)
const target = ref<PlanDto | null>(null)

function openDelete(p: PlanDto) {
  target.value = p
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!target.value) return
  deleting.value = true
  try {
    await plans.remove(target.value.uuid)
    toast.add({ title: 'Plan eliminado', color: 'success', icon: 'i-lucide-check-circle' })
    deleteOpen.value = false
    // Si la página queda vacía tras borrar, retrocede una.
    if (data.value.length === 1 && page.value > 1) page.value -= 1
    else await load()
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
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold text-prohealth-900">Planes</h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          Planes de cobertura: pricing, beneficiarios y periodo de gracia.
        </p>
      </div>
      <UTooltip :text="canCreate ? 'Registrar un nuevo plan' : 'No tienes permiso para crear planes'">
        <UButton
          color="primary"
          icon="i-lucide-package-plus"
          :disabled="!canCreate"
          @click="openCreate"
        >
          Nuevo plan
        </UButton>
      </UTooltip>
    </div>

    <!-- Búsqueda -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-4">
      <UInput
        v-model="search"
        placeholder="Buscar por código, nombre o descripción…"
        icon="i-lucide-search"
        size="lg"
        class="w-full max-w-md"
      />
    </div>

    <!-- Tabla -->
    <div class="bg-white rounded-2xl border border-prohealth-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-prohealth-400 border-b border-prohealth-100">
              <th class="px-5 py-3 font-semibold">Plan</th>
              <th class="px-5 py-3 font-semibold">Tipo</th>
              <th class="px-5 py-3 font-semibold">Inscripción</th>
              <th class="px-5 py-3 font-semibold">Mensualidad</th>
              <th class="px-5 py-3 font-semibold">Beneficiarios</th>
              <th class="px-5 py-3 font-semibold">Publicado</th>
              <th class="px-5 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-prohealth-100">
            <TableSkeleton v-if="loading" :rows="8" :cols="7" />
            <tr v-else-if="data.length === 0">
              <td colspan="7" class="px-5 py-12 text-center text-prohealth-500">
                <UIcon name="i-lucide-package" class="w-8 h-8 mx-auto mb-2 text-prohealth-300" />
                Sin planes
              </td>
            </tr>
            <tr
              v-for="p in data"
              v-else
              :key="p.uuid"
              class="hover:bg-prohealth-50/50 cursor-pointer"
              @click="navigateTo(`/dashboard/plans/${p.uuid}`)"
            >
              <td class="px-5 py-3">
                <div class="font-semibold text-prohealth-900">{{ p.name }}</div>
                <div class="text-xs text-prohealth-500 font-mono">{{ p.code }}</div>
              </td>
              <td class="px-5 py-3">
                <UBadge color="primary" variant="subtle" size="sm">{{ planTypeLabel(p.type) }}</UBadge>
              </td>
              <td class="px-5 py-3 text-prohealth-700">{{ formatMoney(p.inscriptionFee) }}</td>
              <td class="px-5 py-3 text-prohealth-700">{{ formatMoney(p.monthlyFee) }}</td>
              <td class="px-5 py-3 text-prohealth-700">
                {{ p.includedBeneficiaries }} incl.
                <span class="text-prohealth-400">· máx {{ p.maxBeneficiaries ?? '∞' }}</span>
              </td>
              <td class="px-5 py-3">
                <UBadge :color="p.published ? 'success' : 'neutral'" variant="subtle" size="sm">
                  {{ p.published ? 'Publicado' : 'Borrador' }}
                </UBadge>
              </td>
              <td class="px-5 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <UTooltip text="Ver detalle">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-eye"
                      size="sm"
                      :to="`/dashboard/plans/${p.uuid}`"
                    />
                  </UTooltip>
                  <UTooltip :text="canUpdate ? 'Editar' : 'No tienes permiso para editar'">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      size="sm"
                      :disabled="!canUpdate"
                      @click="openEdit(p)"
                    />
                  </UTooltip>
                  <UTooltip :text="canDelete ? 'Eliminar' : 'No tienes permiso para eliminar'">
                    <UButton
                      color="error"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      size="sm"
                      :disabled="!canDelete"
                      @click="openDelete(p)"
                    />
                  </UTooltip>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div class="flex items-center justify-between px-5 py-3 border-t border-prohealth-100">
        <p class="text-xs text-prohealth-500">
          {{ data.length }} de {{ total }} plan(es)
        </p>
        <UPagination
          v-model:page="page"
          :total="total"
          :items-per-page="size"
        />
      </div>
    </div>

    <!-- Modal crear/editar (compartido con el detalle) -->
    <PlanFormModal v-model:open="formOpen" :plan="editingPlan" @saved="onSaved" />

    <!-- Modal confirmar eliminación -->
    <UModal v-model:open="deleteOpen" title="Eliminar plan">
      <template #body>
        <p class="text-sm text-prohealth-700">
          ¿Seguro que deseas eliminar el plan
          <span class="font-semibold">{{ target?.name }}</span>?
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

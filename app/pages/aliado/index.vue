<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CatalogItem } from '~/types/catalogs'
import type { AllyServiceDto } from '~/types/allies'

// Panel del aliado: proponer servicios (POST /v1/aliado/services, nacen en PROPOSED).
// El backend exige que el usuario tenga membresía OWNER/STAFF en el ally indicado.
//
// LIMITACIÓN backend: no existe `GET /v1/me/ally`, así que el UUID del aliado se
// pide una vez y se recuerda en localStorage. Cuando el backend lo exponga,
// reemplazar el campo por la carga automática.
definePageMeta({
  layout: 'dashboard',
  middleware: 'role',
  roles: ['ALIADO'],
})

useSeoMeta({ title: 'Mi empresa aliada — OptiBienestar 360' })

const allies = useAllies()
const toast = useToast()

const ALLY_UUID_KEY = 'aliado:ally-uuid'

// ---- Catálogo de categorías ----
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
  state.allyUuid = localStorage.getItem(ALLY_UUID_KEY) ?? ''
  loadCategories()
})

// ---- Formulario de propuesta ----
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

const schema = z.object({
  allyUuid: z.string().uuid('Debe ser un UUID válido'),
  serviceCategoryUuid: z.string({ message: 'Requerido' }).min(1, 'Requerido'),
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().optional(),
  priceUsd: z.string().regex(/^\d*(\.\d{1,2})?$/, 'Monto no válido').optional().or(z.literal('')),
  discountPct: z.string().regex(/^\d*(\.\d{1,2})?$/, 'Porcentaje no válido').optional().or(z.literal('')),
})

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
    localStorage.setItem(ALLY_UUID_KEY, state.allyUuid)
    toast.add({
      title: 'Servicio propuesto',
      description: 'Quedó en revisión; el equipo de OptiBienestar 360 lo aprobará.',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    // Conserva allyUuid para la siguiente propuesta; limpia el resto.
    state.serviceCategoryUuid = undefined
    state.name = ''
    state.description = ''
    state.priceUsd = ''
    state.discountPct = ''
    state.requiresAppointment = false
  }
  catch {
    // useApi ya notificó el error (403 si no tienes membresía OWNER/STAFF en ese ally)
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <div>
      <h1 class="text-2xl font-extrabold text-prohealth-900">Mi empresa aliada</h1>
      <p class="text-sm text-prohealth-700/70 mt-1">
        Propón nuevos servicios para tu empresa. Quedan en revisión hasta que OptiBienestar 360 los apruebe.
      </p>
    </div>

    <!-- Última propuesta -->
    <UAlert
      v-if="lastProposed"
      color="success"
      variant="subtle"
      icon="i-lucide-clock"
      :title="`«${lastProposed.name}» enviado a revisión`"
      description="Te notificaremos cuando sea aprobado y publicado en el directorio."
    />

    <!-- Formulario -->
    <div class="bg-white rounded-2xl border border-prohealth-100 p-6">
      <h2 class="font-bold text-prohealth-900 mb-1">Proponer un servicio</h2>
      <p class="text-xs text-prohealth-500 mb-5">
        Debes tener membresía activa (propietario o personal) en la empresa aliada.
      </p>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="UUID de tu empresa aliada"
          name="allyUuid"
          required
          help="Te lo proporciona el equipo de OptiBienestar 360 al registrar tu empresa. Se recordará para próximas propuestas."
        >
          <UInput
            v-model="state.allyUuid"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            icon="i-lucide-building-2"
            class="w-full font-mono"
          />
        </UFormField>

        <UFormField label="Categoría" name="serviceCategoryUuid" required>
          <USelectMenu
            v-model="state.serviceCategoryUuid"
            :items="categoryOptions"
            label-key="label"
            value-key="value"
            placeholder="Selecciona"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Nombre del servicio" name="name" required>
          <UInput v-model="state.name" placeholder="Consulta de Cardiología" class="w-full" />
        </UFormField>

        <UFormField label="Descripción" name="description">
          <UTextarea v-model="state.description" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UFormField label="Precio (USD)" name="priceUsd">
            <UInput v-model="state.priceUsd" placeholder="100.00" class="w-full" />
          </UFormField>
          <UFormField label="Descuento afiliados (%)" name="discountPct">
            <UInput v-model="state.discountPct" placeholder="10.00" class="w-full" />
          </UFormField>
          <UFormField label="Requiere cita" name="requiresAppointment">
            <USwitch v-model="state.requiresAppointment" />
          </UFormField>
        </div>

        <div class="flex justify-end pt-2">
          <UButton type="submit" color="primary" :loading="isSubmitting" icon="i-lucide-send">
            Enviar propuesta
          </UButton>
        </div>
      </UForm>
    </div>

    <!-- Ayuda -->
    <div class="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 text-sm text-prohealth-800 space-y-2">
      <p class="font-semibold flex items-center gap-2">
        <UIcon name="i-lucide-info" class="w-4 h-4 text-cyan-600" />
        ¿Cómo funciona?
      </p>
      <ol class="list-decimal list-inside space-y-1 text-prohealth-700">
        <li>Envías la propuesta del servicio con su precio y descuento para afiliados.</li>
        <li>El equipo de OptiBienestar 360 la revisa y aprueba.</li>
        <li>Una vez publicado, aparece en el <NuxtLink to="/aliados" class="text-cyan-700 hover:underline">directorio público</NuxtLink>.</li>
      </ol>
    </div>
  </div>
</template>

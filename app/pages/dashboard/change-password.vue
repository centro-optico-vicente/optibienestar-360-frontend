<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'dashboard' })

useSeoMeta({ title: 'Cambiar contraseña — OptiSalud Plus' })

const { changePassword } = useAuth()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const schema = z
  .object({
    currentPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    newPassword: z
      .string()
      .min(10, 'Mínimo 10 caracteres')
      .regex(/[A-Z]/, 'Debe incluir una mayúscula')
      .regex(/[a-z]/, 'Debe incluir una minúscula')
      .regex(/[0-9]/, 'Debe incluir un número')
      .regex(/[^A-Za-z0-9]/, 'Debe incluir un símbolo'),
    confirmPassword: z.string(),
  })
  .refine(d => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  })
  .refine(d => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'La nueva contraseña debe ser distinta a la actual',
  })

type Schema = z.infer<typeof schema>

const state = reactive<Partial<Schema>>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const isSubmitting = ref<boolean>(false)
const apiError = ref<string | null>(null)
const showFields = reactive<{ current: boolean, next: boolean, confirm: boolean }>({
  current: false,
  next: false,
  confirm: false,
})

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    await changePassword({
      currentPassword: event.data.currentPassword,
      newPassword: event.data.newPassword,
    })
    toast.add({
      title: 'Contraseña actualizada',
      description: 'Tu nueva contraseña ya está activa.',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await router.push('/dashboard')
  }
  catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'No fue posible actualizar la contraseña'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <UAlert
      v-if="auth.mustChangePassword"
      color="warning"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      title="Cambio de contraseña obligatorio"
      description="Tu contraseña actual es temporal. Defínela ahora para continuar usando el portal."
      class="mb-6"
    />

    <div class="bg-white rounded-2xl border border-prohealth-100 p-6 md:p-8">
      <div class="mb-6">
        <h1 class="text-xl md:text-2xl font-extrabold text-prohealth-900">
          Cambiar contraseña
        </h1>
        <p class="text-sm text-prohealth-700/70 mt-1">
          La nueva contraseña debe tener al menos 10 caracteres, con mayúscula,
          minúscula, número y símbolo.
        </p>
      </div>

      <UForm
        :schema="schema"
        :state="state"
        class="space-y-5"
        @submit="onSubmit"
      >
        <UFormField label="Contraseña actual" name="currentPassword" required>
          <UInput
            v-model="state.currentPassword"
            :type="showFields.current ? 'text' : 'password'"
            autocomplete="current-password"
            icon="i-lucide-lock"
            size="lg"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showFields.current ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                @click="showFields.current = !showFields.current"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField label="Nueva contraseña" name="newPassword" required>
          <UInput
            v-model="state.newPassword"
            :type="showFields.next ? 'text' : 'password'"
            autocomplete="new-password"
            icon="i-lucide-key-round"
            size="lg"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showFields.next ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                @click="showFields.next = !showFields.next"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField label="Confirmar nueva contraseña" name="confirmPassword" required>
          <UInput
            v-model="state.confirmPassword"
            :type="showFields.confirm ? 'text' : 'password'"
            autocomplete="new-password"
            icon="i-lucide-check"
            size="lg"
            class="w-full"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showFields.confirm ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                @click="showFields.confirm = !showFields.confirm"
              />
            </template>
          </UInput>
        </UFormField>

        <UAlert
          v-if="apiError"
          color="error"
          variant="subtle"
          :title="apiError"
          icon="i-lucide-circle-alert"
        />

        <div class="flex items-center justify-end gap-3 pt-2">
          <UButton
            to="/dashboard"
            color="neutral"
            variant="ghost"
            :disabled="auth.mustChangePassword || isSubmitting"
          >
            Cancelar
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :loading="isSubmitting"
            icon="i-lucide-shield-check"
          >
            Guardar nueva contraseña
          </UButton>
        </div>
      </UForm>
    </div>
  </div>
</template>

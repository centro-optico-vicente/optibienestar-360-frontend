<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'

definePageMeta({ layout: 'auth' })

useSeoMeta({ title: 'Restablecer contraseña — OptiBienestar 360' })

const { resetPassword } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// El token llega como query param desde el enlace del correo.
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))

const schema = z
  .object({
    newPassword: z
      .string()
      .min(10, 'Mínimo 10 caracteres')
      .max(128, 'Máximo 128 caracteres')
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
type Schema = z.infer<typeof schema>

const state = reactive<Partial<Schema>>({ newPassword: '', confirmPassword: '' })
const isSubmitting = ref(false)
const apiError = ref<string | null>(null)

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    await resetPassword(token.value, event.data.newPassword)
    toast.add({
      title: 'Contraseña restablecida',
      description: 'Ya puedes iniciar sesión con tu nueva contraseña.',
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await router.push('/login')
  }
  catch (err: unknown) {
    apiError.value = (err as ApiError)?.message || 'El enlace no es válido o ha expirado'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h2 class="text-2xl md:text-3xl font-extrabold text-prohealth-900">
        Restablecer contraseña
      </h2>
      <p class="text-sm text-prohealth-700/70 mt-1">
        Define una nueva contraseña para tu cuenta.
      </p>
    </div>

    <UAlert
      v-if="!token"
      color="error"
      variant="subtle"
      icon="i-lucide-link-2-off"
      title="Enlace no válido"
      description="Falta el token de recuperación. Solicita un nuevo enlace desde 'Recuperar contraseña'."
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField label="Nueva contraseña" name="newPassword" required>
        <UInput
          v-model="state.newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Confirmar contraseña" name="confirmPassword" required>
        <UInput
          v-model="state.confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UAlert
        v-if="apiError"
        color="error"
        variant="subtle"
        :title="apiError"
        icon="i-lucide-circle-alert"
      />

      <UButton
        type="submit"
        block
        size="lg"
        color="primary"
        :loading="isSubmitting"
        icon="i-lucide-check"
      >
        Restablecer contraseña
      </UButton>
    </UForm>

    <p class="text-center text-sm text-prohealth-700/70 pt-6">
      <NuxtLink to="/login" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
        ← Volver a iniciar sesión
      </NuxtLink>
    </p>
  </div>
</template>

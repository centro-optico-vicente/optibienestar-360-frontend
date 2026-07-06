<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'

definePageMeta({ layout: 'auth' })

useSeoMeta({ title: 'Recuperar contraseña — OptiBienestar 360' })

const { recoverPassword } = useAuth()

const schema = z.object({
  email: z.string().email('Email no válido'),
})
type Schema = z.infer<typeof schema>

const state = reactive<Partial<Schema>>({ email: '' })
const isSubmitting = ref(false)
const sent = ref(false)
const apiError = ref<string | null>(null)

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    await recoverPassword(event.data.email)
    sent.value = true
  }
  catch (err: unknown) {
    apiError.value = (err as ApiError)?.message || 'No fue posible procesar la solicitud'
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
        Recuperar contraseña
      </h2>
      <p class="text-sm text-prohealth-700/70 mt-1">
        Te enviaremos un enlace para restablecer tu contraseña.
      </p>
    </div>

    <UAlert
      v-if="sent"
      color="success"
      variant="subtle"
      icon="i-lucide-mail-check"
      title="Revisa tu correo"
      description="Si el correo existe, recibirás un enlace para restablecer tu contraseña."
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField label="Correo electrónico" name="email" required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          placeholder="tu@correo.com"
          icon="i-lucide-mail"
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
        icon="i-lucide-send"
      >
        Enviar enlace
      </UButton>
    </UForm>

    <p class="text-center text-sm text-prohealth-700/70 pt-6">
      <NuxtLink to="/login" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
        ← Volver a iniciar sesión
      </NuxtLink>
    </p>
  </div>
</template>

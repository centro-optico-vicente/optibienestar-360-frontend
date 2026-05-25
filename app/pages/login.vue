<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

useSeoMeta({
  title: 'Ingresar — OptiSalud Plus',
  description: 'Accede al portal OptiSalud Plus',
})

const { login } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const schema = z.object({
  email: z.string().email('Email no válido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

type LoginSchema = z.infer<typeof schema>

const state = reactive<Partial<LoginSchema>>({
  email: '',
  password: '',
})

const isSubmitting = ref<boolean>(false)
const showPassword = ref<boolean>(false)
const apiError = ref<string | null>(null)

const onSubmit = async (event: FormSubmitEvent<LoginSchema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    const result = await login(event.data)

    toast.add({
      title: '¡Bienvenido!',
      description: `Hola ${result.user.firstName || result.user.email}`,
      color: 'success',
      icon: 'i-lucide-check-circle',
    })

    if (result.mustChangePassword || result.user.mustChangePassword) {
      await router.push('/dashboard/change-password')
      return
    }

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.push(redirect)
  }
  catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'No fue posible iniciar sesión'
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
        Bienvenido de nuevo
      </h2>
      <p class="text-sm text-prohealth-700/70 mt-1">
        Ingresa con tus credenciales para acceder al portal.
      </p>
    </div>

    <UForm
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

      <UFormField label="Contraseña" name="password" required>
        <UInput
          v-model="state.password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          class="w-full"
        >
          <template #trailing>
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>

      <div class="flex items-center justify-between text-sm">
        <UCheckbox label="Recordarme" />
        <NuxtLink to="/recover-password" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
          ¿Olvidaste tu contraseña?
        </NuxtLink>
      </div>

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
        icon="i-lucide-log-in"
      >
        Ingresar
      </UButton>

      <p class="text-center text-sm text-prohealth-700/70 pt-2">
        ¿No tienes cuenta?
        <span class="text-prohealth-900 font-medium">Contacta a un promotor.</span>
      </p>
    </UForm>
  </div>
</template>

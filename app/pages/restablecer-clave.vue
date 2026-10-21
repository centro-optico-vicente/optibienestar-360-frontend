<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'

// English pair of this public screen (hub URL convention): same page, rendered
// in English by middleware/public-locale.global.ts. The fixed `key` keeps the
// component (and any typed input) when the switcher jumps between the two URLs.
definePageMeta({ layout: 'auth', alias: ['/en/reset-password'], key: 'public-reset-password' })

const { t } = useI18n()
const publicPath = usePublicPath()

useSeoMeta({ title: () => t('auth.reset.seoTitle') })

// The reset token is a credential: never leak it to third parties through the
// Referer header (fonts, CDNs, analytics) while it is still on this page.
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }] })

const { resetPassword } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// The token arrives as a query param from the email link. It is read once and
// kept in memory; the URL is then cleaned (no reload) so it does not linger in
// the address bar or the browser history. Without the link (or when the email
// button did not work) the user pastes the code from the email into a field.
const linkToken = typeof route.query.token === 'string' ? route.query.token.trim() : ''
// The paste field is shown when no link token arrived, or after the API rejects
// the link token (so a mistyped/truncated link can be fixed by hand).
const showTokenField = ref(linkToken === '')

onMounted(() => {
  if (route.query.token === undefined) return
  const query = { ...route.query }
  delete query.token
  router.replace({ path: route.path, query, hash: route.hash })
})

// Mirrors the backend policy (ResetPasswordRequest: 8–128 chars, no complexity
// rules; the last N passwords cannot be reused — reported by the API).
const schema = computed(() => z
  .object({
    token: z.string().trim().min(1, t('validation.required')),
    newPassword: z
      .string()
      .min(8, t('validation.minChars', { n: 8 }))
      .max(128, t('validation.maxChars', { n: 128 })),
    confirmPassword: z.string(),
  })
  .refine((d: { newPassword: string, confirmPassword: string }) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: t('validation.passwordsMismatch'),
  }))

interface Schema {
  token: string
  newPassword: string
  confirmPassword: string
}

const state = reactive<Partial<Schema>>({ token: linkToken, newPassword: '', confirmPassword: '' })
const isSubmitting = ref(false)
const apiError = ref<string | null>(null)

const onSubmit = async (event: FormSubmitEvent<Schema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    await resetPassword(event.data.token, event.data.newPassword)
    toast.add({
      title: t('auth.reset.successTitle'),
      description: t('auth.reset.successDescription'),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
    await router.push(publicPath('/'))
  }
  catch (err: unknown) {
    apiError.value = (err as ApiError)?.message || t('auth.reset.errorFallback')
    showTokenField.value = true
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
        {{ $t('auth.reset.heading') }}
      </h2>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ $t('auth.reset.subheading') }}
      </p>
    </div>

    <UForm
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField
        v-if="showTokenField"
        :label="$t('auth.fields.resetToken')"
        :help="$t('auth.reset.tokenHelp')"
        name="token"
        required
      >
        <UInput
          v-model="state.token"
          type="text"
          autocomplete="one-time-code"
          autocapitalize="off"
          spellcheck="false"
          :placeholder="$t('auth.reset.tokenPlaceholder')"
          icon="i-lucide-key-round"
          size="lg"
          class="w-full font-mono"
        />
      </UFormField>

      <UFormField :label="$t('auth.fields.newPassword')" name="newPassword" required>
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

      <UFormField :label="$t('auth.fields.confirmPassword')" name="confirmPassword" required>
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
        {{ $t('auth.reset.submit') }}
      </UButton>
    </UForm>

    <p class="text-center text-sm text-prohealth-700/70 pt-6">
      <NuxtLink :to="publicPath('/')" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
        {{ $t('auth.backToLogin') }}
      </NuxtLink>
    </p>
  </div>
</template>

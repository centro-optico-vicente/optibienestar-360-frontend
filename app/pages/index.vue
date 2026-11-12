<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiError } from '~/types/auth'

// English pair of this public screen (hub URL convention): same page, rendered
// in English by middleware/public-locale.global.ts. The fixed `key` keeps the
// component (and any typed input) when the switcher jumps between the two URLs.
definePageMeta({ layout: 'auth', alias: ['/en'], key: 'public-login' })

const { t } = useI18n()
const publicPath = usePublicPath()

// Same WhatsApp as the floating contact button of the public website.
const CONTACT_WHATSAPP_URL = 'https://wa.me/584122925608'

useSeoMeta({
  title: () => t('auth.login.seoTitle'),
  description: () => t('auth.login.seoDescription'),
})

const { login, requestMagicLink } = useAuth()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// Onboarding policy (hub ADR 0037): a closed self-registration lands here with
// `?registration=member|ally`, and the "become an ally" link hides while closed.
const { load: loadOnboardingPolicy, memberSelfRegistrationEnabled, allySelfRegistrationEnabled } = usePublicOnboardingPolicy()
const closedRegistration = computed<'member' | 'ally' | null>(() => {
  const value = route.query.registration
  return value === 'member' || value === 'ally' ? value : null
})
onMounted(() => { void loadOnboardingPolicy() })

// "Cédula o correo" (hub ADR 0037 §3): the backend resolves the account from either.
const identifierSchema = computed(() => z.string().trim().min(3, t('validation.minChars', { n: 3 })))

const schema = computed(() => z.object({
  identifier: identifierSchema.value,
  // No length rule on login: an account may predate the current password policy (e.g. demo users).
  // Only reject an empty value or one made solely of whitespace (spaces, tabs, line breaks).
  password: z.string().refine(v => v.trim().length > 0, t('validation.required')),
}))

interface LoginSchema {
  identifier: string
  password: string
}

const state = reactive<Partial<LoginSchema>>({
  identifier: '',
  password: '',
})

const isSubmitting = ref<boolean>(false)
const showPassword = ref<boolean>(false)
const apiError = ref<string | null>(null)
const lockedUntil = ref<Date | null>(null)
const isSendingLink = ref<boolean>(false)
const linkSentTo = ref<string | null>(null)
const identifierError = ref<string | null>(null)

// Mientras la cuenta esté bloqueada (HTTP 423) deshabilitamos el botón.
const isLocked = computed<boolean>(() => !!lockedUntil.value && lockedUntil.value > new Date())

// The submit button stays disabled until both fields have something other than whitespace.
const canSubmit = computed<boolean>(() => !!state.identifier?.trim() && !!state.password?.trim())

const onSubmit = async (event: FormSubmitEvent<LoginSchema>): Promise<void> => {
  isSubmitting.value = true
  apiError.value = null
  try {
    const result = await login({ identifier: event.data.identifier.trim(), password: event.data.password })

    toast.add({
      title: t('auth.login.welcomeTitle'),
      description: t('auth.login.welcomeDescription', { name: result.user.fullName || result.user.email }),
      color: 'success',
      icon: 'i-lucide-check-circle',
    })

    // A pending member or ally (hub ADR 0036 / 0037) lands on the registration wizard.
    const home = roleHome(useAuthStore().activeRole)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : home
    await router.push(redirect)
  }
  catch (err: unknown) {
    const e = err as ApiError
    if (e?.status === 423 && e.problem?.lockedUntil) {
      lockedUntil.value = new Date(e.problem.lockedUntil)
    }
    apiError.value = e?.message || t('auth.login.errorFallback')
  }
  finally {
    isSubmitting.value = false
  }
}

// Passwordless entry: the backend always answers 200, so the confirmation is the
// same whether or not the account exists (nothing about it is revealed).
const onSendLink = async (): Promise<void> => {
  const parsed = identifierSchema.value.safeParse(state.identifier ?? '')
  identifierError.value = parsed.success ? null : (parsed.error.issues[0]?.message ?? t('validation.required'))
  if (!parsed.success) return
  isSendingLink.value = true
  apiError.value = null
  try {
    await requestMagicLink(parsed.data)
    linkSentTo.value = parsed.data
  }
  catch (err: unknown) {
    apiError.value = (err as ApiError)?.message || t('auth.login.magicLink.errorFallback')
  }
  finally {
    isSendingLink.value = false
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <h2 class="text-2xl md:text-3xl font-extrabold text-prohealth-900">
        {{ $t('auth.login.heading') }}
      </h2>
      <p class="text-sm text-prohealth-700/70 mt-1">
        {{ $t('auth.login.subheading') }}
      </p>
    </div>

    <UAlert
      v-if="closedRegistration"
      class="mb-5"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      :title="$t(`auth.login.registrationClosed.${closedRegistration}`)"
    />

    <UForm
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="onSubmit"
    >
      <UFormField
        :label="$t('auth.fields.identifier')"
        :help="$t('auth.fields.identifierHelp')"
        :error="identifierError ?? undefined"
        name="identifier"
        required
      >
        <UInput
          v-model="state.identifier"
          type="text"
          autocomplete="username"
          autocapitalize="off"
          :placeholder="$t('auth.fields.identifierPlaceholder')"
          icon="i-lucide-user"
          size="lg"
          class="w-full"
          @update:model-value="identifierError = null"
        />
      </UFormField>

      <UFormField :label="$t('auth.fields.password')" name="password" required>
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
        <UCheckbox :label="$t('auth.login.rememberMe')" />
        <NuxtLink :to="publicPath('/recuperar-clave')" class="text-prohealth-600 hover:text-prohealth-700 font-medium">
          {{ $t('auth.login.forgotPassword') }}
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
        :disabled="isLocked || !canSubmit"
        class="disabled:cursor-not-allowed"
        icon="i-lucide-log-in"
      >
        {{ $t('auth.login.submit') }}
      </UButton>

      <UAlert
        v-if="linkSentTo"
        color="success"
        variant="subtle"
        icon="i-lucide-mail-check"
        :title="$t('auth.login.magicLink.sentTitle')"
        :description="$t('auth.login.magicLink.sentDescription')"
      />

      <UButton
        type="button"
        block
        size="lg"
        color="neutral"
        variant="outline"
        :loading="isSendingLink"
        icon="i-lucide-mail"
        @click="onSendLink"
      >
        {{ $t('auth.login.magicLink.submit') }}
      </UButton>

      <p class="text-center text-sm text-prohealth-700/70 pt-2">
        {{ $t('auth.login.noAccount') }}
        <template v-if="memberSelfRegistrationEnabled">
          <NuxtLink :to="publicPath('/afiliarse')" class="text-cyan-700 font-medium hover:underline">{{ $t('auth.login.joinLink') }}</NuxtLink>
          {{ $t('auth.login.or') }}
          <a :href="CONTACT_WHATSAPP_URL" target="_blank" rel="noopener" class="text-prohealth-900 font-medium hover:underline">{{ $t('auth.login.contactPromoterInline') }}</a>
        </template>
        <a v-else :href="CONTACT_WHATSAPP_URL" target="_blank" rel="noopener" class="text-prohealth-900 font-medium hover:underline">{{ $t('auth.login.contactPromoter') }}</a>
      </p>
      <p v-if="allySelfRegistrationEnabled" class="text-center text-sm text-prohealth-700/70">
        {{ $t('auth.login.becomeAllyPrompt') }}
        <NuxtLink :to="publicPath('/solicitar-alianza')" class="text-cyan-700 font-medium hover:underline">{{ $t('auth.login.becomeAllyLink') }}</NuxtLink>
      </p>
    </UForm>
  </div>
</template>

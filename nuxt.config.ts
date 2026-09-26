// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  future: {
    compatibilityVersion: 4,
  },

  devtools: { enabled: true },

  ssr: false,

  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@vee-validate/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // Portal light-only: fijamos el tema claro para que los tokens de Nuxt UI
  // (p. ej. --ui-text-highlighted, que usa el texto de los inputs) no se inviertan
  // a blanco cuando el SO está en modo oscuro. Sin esto, el texto del input queda
  // blanco sobre el fondo blanco forzado en main.css.
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },

  app: {
    head: {
      title: 'OptiBienestar 360',
      htmlAttrs: { lang: 'es' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Programa de salud y bienestar OptiBienestar 360' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
        },
      ],
      // Runtime config loaded before the app bundle. The container rewrites
      // /config.js from env vars on start (see 00.runtime-config.client.ts);
      // a single image then serves any environment without a rebuild.
      script: [
        { src: '/config.js', tagPosition: 'head' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: '',
      // Hub plan competitive-commission-rules, Fase A — overridden at runtime
      // from window.__APP_CONFIG__.TIME_ZONE (see 00.runtime-config.client.ts).
      timeZone: 'America/Caracas',
    },
  },

  i18n: {
    defaultLocale: 'es',
    strategy: 'no_prefix',
    locales: [
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    lazy: true,
  },

  veeValidate: {
    autoImports: true,
    componentNames: {
      Form: 'VeeForm',
      Field: 'VeeField',
      ErrorMessage: 'VeeErrorMessage',
    },
  },

  pinia: {
    storesDirs: ['./app/stores/**'],
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})

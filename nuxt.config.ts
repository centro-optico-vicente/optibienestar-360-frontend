// https://nuxt.com/docs/api/configuration/nuxt-config

// Brand typeface (Manual de Marca OB360, p. 05). Changing the family here (plus
// --font-sans in app/assets/css/main.css) switches the whole UI; components only
// use Tailwind's font-sans.
const BRAND_FONT = {
  family: 'Poppins',
  weights: '300;400;500;600;700',
}

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
        // Favicons generated from the OB360 isotype (provisional raster, see BrandLogo.vue)
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/png', href: '/favicon-32.png', sizes: '32x32' },
        { rel: 'icon', type: 'image/png', href: '/icon-512.png', sizes: '512x512' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: `https://fonts.googleapis.com/css2?family=${BRAND_FONT.family}:wght@${BRAND_FONT.weights}&display=swap`,
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

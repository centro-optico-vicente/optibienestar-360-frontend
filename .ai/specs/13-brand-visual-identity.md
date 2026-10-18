# 13 — Identidad visual de marca (OptiBienestar 360)

> **Fuente de verdad:** `MANUAL DE MARCA OPTIBIENESTAR 360.pdf` (15-oct-2026) y los archivos del diseñador (`logos/`, 18-oct-2026), fuera de git en `~/workspace/fenix-core/optibienestar/`.
> **Copia cross-stack:** [hub spec 11](https://github.com/centro-optico-vicente/centro-optico-vicente/blob/main/.ai/specs/11-brand-visual-identity.md). Si el manual cambia, se actualizan las dos.
> Esta spec agrega **cómo se aplica en este repo**: tokens, componentes y reglas de pantalla.
> **Relacionadas:** [`10-design-system.md`](10-design-system.md) (componentes) y [`../context/design-tokens.md`](../context/design-tokens.md) (detalle de tokens).

## 1. Esencia y voz

- **Concepto:** *"Cuidar de las personas, desde todos los ángulos."* Bienestar integral, a 360°.
- **Personalidad:** Integral · Confiable · Vital · Cercana.
- **Voz:** Clara · Empática · Profesional · Motivadora. Al afiliado se le trata de **tú**.
- **Significado de los colores:**
  - Azul = confianza.
  - Verde = salud y vida.
  - Naranja = energía y acción.
  - La "P" en el círculo = la persona en el centro.
- **Glosario de UI** (Propuesta de Identidad Corporativa, aplicado en #228):

  | Usar | No usar | Alcance |
  |---|---|---|
  | **Asesor / Asesor Comercial** | promotor | Toda la app |
  | **Credencial Digital** | carnet | Toda la app |
  | **Tarifa Preferencial** | descuento | Lo que ven aliados y afiliados |
  | **Gestión de Cartera** | cobranza | Portales |
  | **Participación en Ecosistema** | comisiones | Portales |

## 2. Paleta

| Nombre | HEX | Rol | Token en este repo |
|---|---|---|---|
| **Azul Profundo** | `#003F84` | Principal: títulos, fondos de marca | `prohealth-800` |
| **Azul Vital** | `#067DBC` | Principal: `primary`, subtítulos, enlaces | `prohealth-500`, `cyan-600` |
| **Verde Bienestar** | `#7BC621` | Principal (acento): `secondary` | `lime-500` |
| **Naranja Energía** | `#FF7605` | Acento: CTA y `warning` | `energia-500` |
| Azul Océano | `#0D498B` | Apoyo: hover y bordes | `prohealth-700` |
| Verde Lima | `#8CDD12` | Apoyo: acento sobre fondos oscuros | `lime-400` |
| Gris Carbón | `#1B2733` | Apoyo: **texto** | `--ui-text` |
| Gris Perla | `#EEF2F6` | Apoyo: **fondos** | `--ui-bg-muted` |

- **Proporción de uso:** blanco 45 % · Azul Profundo 25 % · Azul Vital 13 % · Verde 11 % · Naranja 6 %. Predominan el blanco y el azul; verde y naranja son acento.
- **Degradado:** `#003F84 → #067DBC`, en la clase `.bg-hero-prohealth`.

### 2.1 Escalas implementadas (`app/assets/css/main.css`, `@theme static`)

Se conservan los **nombres** de escala ya existentes para no renombrar unas 2 281 clases (\* = anclaje del manual):

| Escala | Nuxt UI | 50 · 100 · 200 · 300 · 400 · 500 · 600 · 700 · 800 · 900 · 950 |
|---|---|---|
| `prohealth` | `primary` | F1F8FD · E1EFFA · C5DFF2 · A3CAE8 · 76AFD9 · \*067DBC · 0A63A4 · \*0D498B · \*003F84 · 082D5A · 091B32 |
| `lime` | `secondary` | F3FDEC · E5FBD6 · CEF5B1 · AFEB7D · \*8CDD12 · \*7BC621 · 5E9916 · 477904 · 365C05 · 2B4A05 · 162B00 |
| `cyan` | `info` | F1F8FD · E1EFFA · C5DFF2 · A3CAE8 · 7BB2DB · 4C97CC · \*067DBC · 0C6091 · 014C75 · 043C5C · 02273E |
| `energia` | `warning` | FFF7F2 · FFECE2 · FED6C2 · FDB994 · FC9458 · \*FF7605 · D26008 · AA4D07 · 873C05 · 6F3001 · 411901 |

**Prohibido:**
- Hex sueltos en componentes: usar siempre las clases de escala o `var(--color-…)`.
- Las paletas viejas: `#245E9E`, `#1094C5`, `#9FD537`, `#0056B3`, `#00B85C`, `#FF5E00`.

### 2.2 Contraste (obligatorio)

| Combinación | Ratio | ¿Se puede? |
|---|---|---|
| Texto `prohealth-800/900` o `--ui-text` sobre blanco o Gris Perla | ≥ 10 | ✅ |
| Texto o fondo `prohealth-500` (Azul Vital) con blanco | 4.50 | ✅ (texto ≥ 14 px) |
| Texto `lime-500`/`lime-400` o `energia-500` sobre blanco | 2.1 / 2.7 | ❌ → usar `lime-700` / `energia-700` |
| Texto blanco sobre `lime-500` o `energia-500` | 2.1 / 2.7 | ❌ → texto `prohealth-950` o Gris Carbón |
| Gris Carbón sobre verde o naranja | 7.2 / 5.7 | ✅ |

⚠️ Los badges y botones `warning` sólidos (naranja) con texto blanco **no pasan AA**, igual que antes con el ámbar. En piezas nuevas, usar la variante `soft`/`subtle` o texto oscuro.

## 3. Tipografía

- **Familia:** **Poppins** 300–700 desde Google Fonts. Se define una sola vez en `BRAND_FONT` (`nuxt.config.ts`) y la refleja `--font-sans` en `main.css`. Fallback: `ui-sans-serif, system-ui, Arial, sans-serif`.
- ❓ El manual también nombra **Satoshi** como espécimen principal. Si el diseñador la confirma, se cambia en `BRAND_FONT`, alojando los `woff2` en el propio servidor (Fontshare); no está en Google Fonts.
- **Pesos:** 700 títulos · 500 subtítulos y botones · 400 cuerpo · 300 solo en textos grandes, nunca en tablas o formularios. El peso 800 **no se carga**: `font-extrabold` se ve como 700. En código nuevo, usar `font-bold`.

| Nivel | Clases sugeridas |
|---|---|
| Título de página | `text-2xl font-bold text-prohealth-900` |
| Subtítulo | `text-lg font-medium text-prohealth-500` |
| Cuerpo | `text-sm`/`text-base` + color por defecto (`--ui-text`) |
| CTA | `font-medium`; naranja solo con texto oscuro (ver §2.2) |

## 4. Logo

- **Componente único:** `app/components/BrandLogo.vue`. **Nunca** importar los PNG directamente.

  ```vue
  <BrandLogo />                              <!-- horizontal, fondo claro, 160 px -->
  <BrandLogo variant="negativo" :width="150" /> <!-- sobre Azul Profundo o degradado -->
  <BrandLogo variant="isotipo" :width="32" />   <!-- espacios cuadrados -->
  ```

- **Reglas que aplica el componente:**
  - Mínimo de 120 px de ancho en las versiones horizontales.
  - Zona de protección como padding (12 % del alto, ≈ la "P" de PLAN).
  - Solo fija el ancho; el alto sale de la proporción.
- **Reglas que debe cuidar quien lo usa:**
  - Elegir la versión por contraste con el fondo.
  - No recolorear, rotar ni deformar el logo.
  - Sobre el degradado azul, poner el isotipo encima de un disco blanco (como en la Credencial Digital).
- **Assets** (`app/assets/brand/`):
  - `ob360-logo-horizontal.png`: 1200×269, a color, sin el contorno sticker del EPS.
  - `ob360-logo-negativo.png`: silueta blanca.
  - `ob360-isotipo.png`: 512 px.
  - Por qué son PNG: el SVG exportado del EPS incrusta cientos de mosaicos raster (~1 MB), y el `.ai` llegó vacío.
- **Favicons** (`public/`): `favicon.ico` (16/32/48), `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`, todos desde el isotipo del diseñador.
- ❓ **Pendiente del diseñador:** SVG con degradados planos, y las versiones monocromo y sobre verde.

## 5. Patrones de pantalla (de las aplicaciones del manual)

- **Hero o cabecera de marca:** degradado `.bg-hero-prohealth`, titular blanco con una palabra destacada en `lime-300/400`, logo `negativo`. Opcional: la "P" del isotipo en grande con baja opacidad como textura, y un círculo verde y uno naranja como acentos.
- **Tarjetas:** fondo blanco y radio amplio (`rounded-2xl`/`3xl`) sobre Gris Perla. Si llevan icono, en un círculo de color de marca.
- **Credencial Digital:** degradado azul, isotipo sobre disco blanco, foto o iniciales, QR sobre blanco, badge de cobertura (`success` si la membresía está ACTIVE).
- **Separadores o pies de marca:** franja de 4 colores (Azul Vital · Verde · Verde Lima · Naranja), con moderación.
- **Estados semánticos:** éxito → `success`/`lime-700`; aviso → `warning` (naranja, ver contraste); error → `error`; info → `info`/Azul Vital.

## 6. Checklist para cualquier pantalla nueva

- [ ] Predominan blanco y azul; verde y naranja solo como acento.
- [ ] Títulos en `prohealth-800/900`, texto con el color por defecto y fondos suaves en Gris Perla.
- [ ] Sin hex sueltos ni clases de las paletas viejas.
- [ ] Ningún texto verde o naranja sobre blanco, ni texto blanco sobre verde o naranja.
- [ ] El logo va con `BrandLogo` y la variante correcta, a 120 px o más.
- [ ] La tipografía es la heredada (no se cambia `font-family` por componente); pesos 400 a 700.
- [ ] Los textos siguen el glosario (§1) y van en i18n.

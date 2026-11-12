# 14 — Búsqueda, filtros limpiables, rangos de fecha y debounce en listados

> **Norma general (hub):** [`08-debounce-search-inputs.md`](https://github.com/centro-optico-vicente/centro-optico-vicente/blob/main/.ai/specs/08-debounce-search-inputs.md). Este spec es su parte de frontend.
> **Relacionadas:** [`08-tables.md`](08-tables.md) (paginación + RSQL), [`04-api-client.md`](04-api-client.md).
> **Backend:** [`19-list-search-filters.md`](https://github.com/centro-optico-vicente/optibienestar-360-backend/blob/main/.ai/specs/19-list-search-filters.md) (los parámetros `q`, filtros maestros y `dateFrom`/`dateTo` que consumen estas pantallas).

## Reglas

1. **Todo listado tiene búsqueda de texto libre** y la envía como `q`: tablas, sub-listas de detalle y listas desplegables con búsqueda en servidor.
2. **Toda lista desplegable de filtro es limpiable** (`clear` en `USelectMenu`; `CommonEntityReferenceSelect` ya lo es siempre) y la lógica de carga trata el valor vacío como «sin filtro». Excepción: campos obligatorios de un formulario.
3. **Un solo retraso para escribir**: lo que se teclea se espera, así `asd` rápido genera **una** petición con `q=asd`. Lo discreto (elegir en un select, una fecha, una casilla) recarga **de inmediato**.
4. **Las tablas con fechas operacionales o transaccionales tienen rango** `dateFrom` / `dateTo`. Las bitácoras (sesiones, jobs, cambios de datos, reportes) no.
5. **Las listas desplegables se cargan al abrirse, no al montar.** Ni la vista ni una modal en modo «Nuevo» piden las opciones de sus selects de entrada: cada lista se pide la primera vez que se despliega (o se escribe en ella) con `useLazyOptions`. En edición solo se carga la lista de un campo que ya trae valor (para mostrar su etiqueta), o se siembra la etiqueta que trae el detalle.

## Debounce: una sola fuente

| Qué | Dónde |
|---|---|
| Retardo de **listas desplegables** (búsqueda interna de un select con servidor) | `DEFAULT_DEBOUNCE_MS` en `app/utils/debounce-config.ts` |
| Retardo de **cajas de texto** de tablas y filtros | `TABLE_FILTER_DEBOUNCE_MS` en el mismo archivo |
| Función para un buscador de dropdown | `useSearchDebounce(callback)` (`app/composables/useSearchDebounce.ts`) |
| Función para un buscador de tabla/filtro | `useTableFilterDebounce(callback)` |

Hoy valen 500 ms cada una; **son los dos únicos lugares donde se cambia un retraso**. Prohibido escribir `setTimeout(..., 400)` a mano para un buscador. Quedan fuera de la regla, y pueden usar su propio temporizador, los que no son búsqueda: el icono «copiado», el recálculo de la tasa de cambio, el refresco del token y el autoguardado de borradores.

Patrón típico en una página de tabla:

```ts
const reloadFromFirstPage = () => { if (!resetting.value) { page.value = 1; load() } }
const debouncedSearch = useTableFilterDebounce(reloadFromFirstPage)
watch(search, debouncedSearch)                                  // texto: espera
watch([statusFilter, dateFrom, dateTo, masterFilters], reloadFromFirstPage) // discreto: inmediato
```

Mantener el guard `resetting` dentro del callback para que «Limpiar filtros» no dispare una petición extra. Un select con búsqueda en servidor no exige mínimo de caracteres: al abrirlo vacío lista los primeros resultados (y no busca nada hasta abrirse, salvo que ya tenga un valor).

## Componentes y utilidades compartidas

| Pieza | Para qué |
|---|---|
| `CommonEntityReferenceSelect` | Select de entidad con `:items` o con `:search` (servidor, ya con debounce, perezoso: busca al abrirse), siempre limpiable; emite `open` para cargar `:items` al desplegar |
| `useLazyOptions(loader, initial?)` | Opciones de un select pedidas la primera vez que se abre: `items`, `loading`, `onOpen` (para `@update:open`), `ensureLoaded()` (para quien necesite la lista antes, p. ej. una edición), `reset()`. Una petición por instancia, sin duplicar las simultáneas |
| `DateRangeFilter` | Dos fechas limpiables (`v-model:from` / `v-model:to`, o el evento `change`); si «desde» queda después de «hasta» las intercambia |
| `ListFilterBar` + `utils/listFilters.ts` | Barra genérica de filtros: select (`items` estáticos o `lazy` con `useLazyOptions`), typeahead, fecha y `dateRange` |
| `PaymentMasterFilters` + `utils/paymentFilters.ts` | Afiliado, método, banco, motivo, asesor, moneda y fechas en las pantallas de pagos; `joinRsql` une cláusulas RSQL |
| `AllyMasterFilters` + `utils/allyFilters.ts` | Tipo de aliado, profesión, estado y ciudad (la ciudad se habilita al elegir estado y se limpia si cambia) |
| `utils/textSearch.ts` | Para listas pequeñas filtradas en el navegador: `foldText`, `matchesAny`, `matchesText` (sin tildes ni mayúsculas; un término vacío coincide con todo) |
| `usePromoters().options` / `searchOptions` (desde el PR #306) | Typeahead de asesores contra `GET /v1/admin/advisors/options`; no cargar «los primeros 100» |

## Lecciones de tipos (`vue-tsc`)

- El valor de las opciones de un `USelectMenu` debe ser `String(...)` cuando el `ref` del filtro es `string`; con opciones tipadas como enum y un `ref('')` la compilación falla.
- Con `clear`, limpiar emite `null`/`undefined`: los helpers que arman el filtro (`joinRsql`, `buildFilter`) deben aceptarlos y no generar `status==undefined`.
- Un parámetro de filtro vacío se omite de la query (`|| undefined`), nunca se envía como cadena vacía.

## Checklist para una pantalla de lista nueva

- [ ] Caja de búsqueda con `useTableFilterDebounce`, enviando `q`
- [ ] Un dropdown por cada tabla maestra relevante, limpiable y con valores `String(...)`
- [ ] Opciones de los dropdowns con `useLazyOptions` (nada en `onMounted`)
- [ ] `DateRangeFilter` si la tabla muestra fechas operacionales
- [ ] «Limpiar filtros» restablece todo y respeta el guard `resetting`
- [ ] Sin `setTimeout` de búsqueda ni números de retraso fijos

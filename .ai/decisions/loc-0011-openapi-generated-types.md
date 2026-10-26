# ADR LOC-0011 (frontend) — Tipos TypeScript generados desde el OpenAPI del backend

**Estado:** Propuesto
**Fecha:** 2026-10-25
**Decisores:** equipo OptiBienestar 360 (pendiente de aceptación del dueño)
**Origen:** [`dto-shape-mismatches.md`](../dto-shape-mismatches.md) · [`vertical-10` §Contrato de tipos](../checklists/vertical-10-optimizacion-reportes-hardening.md) ("merece ADR propio") · [auditoría 2026-09-23](../notes/2026-09-23_audit.md) hallazgo F-04
**Relacionado:** [hub ADR 0014 `_Display`](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0014-display-value-convention.md) · [hub ADR 0019 camelCase](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0019-api-json-casing-contract.md) · [hub ADR 0004 only free tools](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0004-only-free-tools.md)

> Este ADR **no** introduce el generador: solo decide si se adopta y cómo. Todo lo marcado **(no verificado)** es una afirmación que no se pudo comprobar leyendo código y que debe resolverse en la Fase 0 del plan.

## Contexto

### El problema, con evidencia

Los `*Dto` del frontend se escriben a mano. `.ai/dto-shape-mismatches.md` documenta la auditoría del 2026-07-15 (todos los `*Dto` de `app/types/` contra record + mapper + tipo de retorno del controller):

- **6 desfases reales**, todos con la misma forma: el backend tiene dos proyecciones por recurso (listar compacto / detalle) y el frontend tenía un solo tipo escrito a mano.
- **Pasaron typecheck, build, CI y code review.** El síntoma nunca es un crash: `?.` lo degrada a `—` o a un bloque que no renderiza. Ejemplo grave: el directorio público de aliados (`/aliados`, tráfico anónimo) no mostraba tipo, ciudad ni especialidades para ningún aliado.
- **Costo en tiempo de vida del bug:** detectado 2026-07-15; el último desfase se cerró el 2026-10-24 (~101 días después). Los arreglos aterrizaron en PRs separados: #38 (`AllyUserDto`), #84 y #195 (tabla admin de aliados), #224 (aliados públicos), #242 (beneficiarios de afiliado), #245 (campo muerto `AllyDto.services`). No se midieron horas-persona; no se puede cuantificar más allá de eso.
- La auditoría 2026-09-23 encontró además que ADR LOC-0008 y specs 03/04/07/08 describían un cable `snake_case` que no existe (F-06), otra forma del mismo problema: documentación escrita a mano que contradice el contrato real.

Los arreglos aplicados hasta hoy son la opción táctica (espejar el cable a mano). El propio documento advierte que "no mata la clase".

### Tamaño del problema hoy (frontend, `origin/main` 2026-10-25)

| Dato | Valor |
|---|---|
| Archivos en `app/types/` | 27 |
| `export interface/type` en `app/types/` | 270 (85 con sufijo `Dto`) |
| Composables | 59 |
| Archivos que referencian `useApi` | 144 (577 referencias) |
| Páginas / componentes `.vue` | 70 / 83 |

### Lo que expone el backend (`origin/main` de `optibienestar-360-backend`)

- **Sí hay OpenAPI:** `org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3` sobre Spring Boot 4.0.6 (`build.gradle`). `application.properties`: `springdoc.api-docs.path=/v3/api-docs`, `springdoc.swagger-ui.path=/swagger-ui.html`. `OpenApiConfig` declara el esquema `BearerAuth` y una versión de contrato **manual** (`API_CONTRACT_VERSION = "1.0.0"`, no incrementada automáticamente).
- **Escala:** 99 clases `@RestController` y ~287 records `*Dto/*Request/*Response`.
- **Seguridad del endpoint:** `SecurityConfig.PUBLIC_PATHS` incluye `/v3/api-docs/**`, `/swagger-ui/**` y `/swagger-ui.html` con `permitAll()`. No existe ninguna propiedad `springdoc.*` en `application-dev/prod/test.properties` (solo en `application.properties`), así que **la especificación completa —incluida toda la superficie `/v1/admin/**`— es pública también en producción**. Esto es un hallazgo de seguridad independiente de este ADR (enumera endpoints, parámetros y DTOs a cualquier anónimo); ver Preguntas abiertas.
- **Ninguna anotación `@Schema`** en `src/main` (0 coincidencias). El esquema se infiere solo de los records y de Bean Validation (114 archivos con `@NotNull/@NotBlank`, la mayoría en requests).
- **Convención `_Display` (hub ADR 0014):** los pares `<rel>_Uuid`/`<rel>_Display` y `<campo>_Display` **no existen en los records**: los emite en serialización `DisplayBeanSerializerModifier` (un `BeanSerializerModifier` de Jackson) a partir de `@Display DisplayRef city`, `@Display(Kind.DATETIME) Instant createdAt`, etc. (ver `AllyListItemDto`). 48 DTOs usan `_Display`.
- **Casing:** camelCase tal cual (sin estrategia de nombres, hub ADR 0019).

### Riesgos técnicos del contrato generado (no verificados — requieren Fase 0)

1. **`_Display` probablemente no aparece en el spec.** swagger-core/springdoc introspeccionan la clase, no pasan por el `BeanSerializerModifier`. Lo esperable es que `/v3/api-docs` describa `city: DisplayRef` (anidado) en vez de `city_Uuid` + `city_Display`, y que omita `createdAt_Display`. Si es así, el tipo generado **mentiría igual que hoy**, en el eje que más usa el frontend. Hace falta un `OpenApiCustomizer`/`ModelConverter` en el backend que replique la regla del modifier (o una prueba de contrato que compare ambos).
2. **Obligatoriedad de campos.** Sin `@Schema(requiredMode)` ni `@NotNull` en responses, springdoc marca los campos como opcionales → el tipo generado tendría `?` en todo, perdiendo parte del valor (hoy los tipos manuales sí declaran obligatorios). Hay que decidir una regla (p. ej. record components primitivos/`@NotNull` = required) y aplicarla en el backend.
3. **Compatibilidad Jackson.** Spring Boot 4 trae Jackson 3 por defecto y el backend mantiene `spring-boot-jackson2` + un `ObjectMapper` propio (`JacksonConfig`). Si springdoc 3.0.3 lee un mapper distinto del que sirve las respuestas, el spec diverge del cable.
4. **Enums y `Page<T>`.** `status` etc. son `String` con `@Display(enumScope=…)`: no habrá uniones literales. Los genéricos `Page<X>` se aplanan a `PageX` por springdoc.
5. **Versión OpenAPI emitida (3.0 vs 3.1)** para springdoc 3.0.3: no verificada; relevante para el generador elegido.

No se levantó el backend ni se descargó `/v3/api-docs` para este ADR; todo lo anterior sale de código fuente.

## Decisión (propuesta)

1. **Adoptar tipos generados desde OpenAPI como fuente de verdad de la forma del cable**, de forma **incremental y condicionada** a que la Fase 0 confirme que el spec es fiel (puntos 1–3 arriba). Si la Fase 0 falla, el ADR pasa a "Rechazado" y se mantiene la opción táctica.
2. **Herramienta: `openapi-typescript` en modo solo-tipos.** Genera un único `app/types/api.d.ts`. **No** se adopta `openapi-fetch` en esta etapa: `useApi` (refresh de token, toasts RFC 7807, `Accept-Language`) se conserva intacto y solo cambian los genéricos (`useApi<components['schemas']['AllyListItemDto']>`). Reevaluar `openapi-fetch` en otro ADR si se quiere inferencia de respuesta por ruta.
3. **Snapshot del spec commiteado** en `api/openapi.json` (revisable en PR: el diff del contrato es visible) **más** `app/types/api.d.ts` generado y commiteado. Un job de CI regenera el `.d.ts` desde el snapshot y falla si hay diferencia (`git diff --exit-code`).
4. **Detección de drift contra el backend vivo:** workflow programado/`workflow_dispatch` que descarga `/v3/api-docs` del entorno TEST, lo compara con `api/openapi.json` y, si difiere, abre un PR de actualización del snapshot (no falla el CI de otros PRs). Fuente alternativa a evaluar: que el CI del backend publique `openapi.json` como artefacto de release (ver Preguntas abiertas).
5. **Convivencia:** `app/types/<modulo>.ts` pasa a **re-exportar** alias del generado (`export type AllyListItemDto = components['schemas']['AllyListItemDto']`), de modo que páginas y composables no cambian de import. Los tipos de formulario/estado de UI, permisos (`types/permissions.ts`) y helpers de label siguen a mano.

## Alternativas

| Opción | Licencia / mantenimiento (npm registry, 2026-10-25) | Veredicto |
|---|---|---|
| **A. `openapi-typescript` 7.13.0 (+ `openapi-fetch` 0.17.0 opcional)** | MIT. Última release 2026-02-11 (8 meses; el paquete se tocó por última vez 2026-06-15). Solo tipos, sin runtime. | **Elegida.** Mínimo acoplamiento con `useApi`; riesgo de mantenimiento: cadencia baja de releases. |
| B. `@hey-api/openapi-ts` 0.99.0 | MIT. Release 2026-06-22. **Pre-1.0** (cambios incompatibles entre minors probables). Genera SDK + tipos y plugins (p. ej. zod, tanstack). | Descartada por ahora: genera cliente propio que duplicaría `useApi`; pre-1.0. Candidata si se quiere generar validadores zod. |
| C. `orval` 8.45.0 | MIT. Muy activo (release 2026-10-25). Genera clientes por tag, hooks (vue-query), mocks. | Descartada: opinionado y voluminoso (cliente completo); sobredimensionado para el problema (solo forma de DTO). |
| D. Seguir a mano + espejar el cable | — | Ya aplicada; no elimina la clase de bug. Es el plan B si la Fase 0 falla. |
| E. Prueba de contrato en el backend (tests que fijan la forma de cada DTO) | — | Complementaria, no sustituye: protege al backend de romper, no al frontend de mentir. |

Las tres herramientas son OSS gratuitas → cumplen hub ADR 0004. Versiones tomadas del registro npm; no se auditó su código.

## Consecuencias

### Positivas
- Cada desfase futuro entre backend y frontend se convierte en **error de typecheck** (la clase de bug de las 6 auditorías).
- El diff de `api/openapi.json` en PR hace visibles los cambios de contrato.
- Se elimina el mantenimiento manual de los ~85 `*Dto` a medida que se migra.

### Negativas / a mitigar
- **Dependencia del backend:** la fidelidad depende de resolver `_Display`, obligatoriedad y mapper (trabajo en el repo backend, no solo aquí).
- Si el spec sigue público en producción, hay que decidir su exposición (ver abajo) antes de que el CI dependa de él.
- Ruido de revisión por `api.d.ts` grande commiteado (tamaño real **no verificado**).
- CI pasa a tener un job extra y una fuente más que puede fallar por razones ajenas al PR.
- Tipos de request: la forma generada de `*Request` puede diferir de los modelos de formulario (strings vacíos, `null`); no se eliminan los tipos de estado de formulario.

## Plan de adopción (cada fase = un PR; nada se construye en local, validación solo por CI)

| Fase | Contenido | Criterio de salida |
|---|---|---|
| **0 — Spike (backend + manual)** | Descargar `/v3/api-docs` de TEST; comprobar: ¿aparece `city_Uuid/_Display`? ¿qué campos son `required`? ¿3.0 o 3.1? ¿tamaño? Comparar 3 DTOs (`AllyListItemDto`, `MemberDetailDto`, `PublicAllyDetailDto`) contra una respuesta real. | Informe con veredicto go/no-go; lista de cambios necesarios en backend. |
| **1 — Backend** | `OpenApiCustomizer` para `_Display`, regla de `required`, y (decisión del dueño) restringir `/v3/api-docs` en prod. | Spec de TEST refleja el cable real en los 3 DTOs. |
| **2 — Tooling frontend** | Dependencia dev `openapi-typescript`, script `api:generate`, `api/openapi.json` + `app/types/api.d.ts`, job CI de regeneración. Sin consumidores. | CI verde; ningún cambio de comportamiento. |
| **3 — Piloto: Aliados** | `types/allies.ts` re-exporta del generado (ya tiene lista/detalle/público auditados: base ideal de comparación). | Typecheck pasa sin cambios de código o los errores revelan desfases reales. |
| **4 — Resto por módulo** | Afiliados, pagos, comisiones, catálogos… un módulo por PR, empezando por los más usados. | Cada PR borra los tipos manuales equivalentes. |
| **5 — Drift programado** | Workflow contra TEST + PR automático del snapshot. | Un cambio de backend aparece como PR en el frontend sin intervención. |

**Rollback:** el generador es solo tipos y convive con los manuales; revertir un PR de módulo restaura los tipos escritos a mano. Fase 2 se revierte quitando dependencia y archivos.

## Preguntas abiertas para el dueño

1. ¿Se restringe `/v3/api-docs` y Swagger UI en producción (hoy `permitAll` en todos los perfiles)? Si se cierra en prod, el snapshot debe venir de TEST o del CI del backend.
2. ¿Quién mantiene el snapshot: el frontend lo descarga de TEST, o el backend publica `openapi.json` como artefacto en su CI (requiere un plugin Gradle de springdoc, **no evaluado**)?
3. ¿Se acepta que parte del trabajo (customizer `_Display`, `required`) viva en el repo backend, con su propio PR/ADR?
4. ¿El tamaño del spec (99 controllers) justifica commitear `api.d.ts`, o se genera en CI y no se versiona?

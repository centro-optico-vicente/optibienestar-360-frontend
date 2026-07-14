# ADR 0007 (local frontend) — Convenciones de Pull Request y ramas (Gitflow)

**Estado:** Aceptado
**Fecha:** 2026-06-01
**Equivalente backend:** [ADR 0004 — PR & branch conventions](https://github.com/fenix-core/optibienestar-360-backend/blob/main/.ai/decisions/0004-pr-and-branch-conventions.md) (misma convención, ejemplos del stack Nuxt)

## Contexto

Se necesita una convención uniforme para nombrar ramas y redactar Pull Requests que sea legible en el historial de GitHub y reproducible por IA en cada sesión. La convención es **idéntica en todos los repos del ecosistema**; este ADR la repite con ejemplos del frontend para que una sesión IA con solo este repo cargado la aplique sin ambigüedad.

## Decisión

### Regla cero — nunca commits directos a `main`

Todo cambio entra a `main` **únicamente vía Pull Request**. Sin excepciones, incluso para hotfixes urgentes o "cambios obvios" de una sola persona.

Razones:
- Historial de `main` limpio (un squash-merge semántico por PR, no commits WIP sueltos).
- CI corre antes del merge → atrapa fallos (typecheck, build, smoke) antes de manchar `main`.
- Cada cambio queda con descripción persistente y discusión asociada al PR.
- Habilita rollback granular vía `gh pr revert <N>`.

Flujo correcto siempre:

```bash
git switch main
git pull origin main
git switch -c <tipo>/<descripción-kebab-case> --no-track
# ... cambios + commits locales ...
git push -u origin <tipo>/<descripción-kebab-case>
gh pr create
```

> `--no-track` evita que la rama quede siguiendo `origin/main` y dispare pushes accidentales a `main`.

Para hotfixes, usar prefijo `hotfix/...` y PR de aprobación rápida — el costo extra es <1 min y mantiene la disciplina.

### Nomenclatura de ramas (Gitflow simplificado)

```
<tipo>/<descripción-corta-en-kebab-case>
```

| Tipo | Cuándo usarlo |
|---|---|
| `feature/` | Nueva funcionalidad (página, componente, store, flujo) |
| `fix/` | Corrección de bug en desarrollo |
| `hotfix/` | Corrección urgente sobre producción (`main`) |
| `chore/` | CI/CD, Dockerfiles, dependencias, configuración, docs |
| `refactor/` | Refactor sin cambio de comportamiento observable |
| `release/` | Preparación de versión (bump, changelog) |

Ejemplos:
```
feature/members-list-page
feature/auth-jwt-login
fix/digital-card-mobile-overflow
chore/github-ci-cd-docker
hotfix/api-base-url-runtime-config
```

### Formato del Pull Request

**Título** — Conventional Commits:
```
<tipo>: <descripción imperativa en minúsculas, máx 70 chars>
```

Ejemplos:
```
feat: Add members list page with role-based columns
fix: Resolve digital card overflow on mobile Safari
chore: Add GitHub CI/CD + Docker image with runtime config
```

**Contenido** (copy-paste directo en GitHub):

```markdown
feat: Add members list page with role-based columns

## Summary

- <bullet qué se hace y por qué — una línea>
- <bullet>
- <bullet>

## Changes

- `app/pages/admin/members.vue` — descripción
- `app/composables/useApi.ts` — descripción

## Test plan

- [ ] Caso feliz: vista carga y renderiza datos esperados
- [ ] Validación: estado de error de API → toast / fallback correcto
- [ ] `pnpm typecheck` pasa
- [ ] `pnpm generate` pasa (CI verde)
```

> **Regla clave:** la primera línea del contenido repite el título exacto del PR. Esto hace que el merge commit en `main` sea legible sin abrir el PR.

## Por qué

- **Conventional Commits** permite generar CHANGELOG automático y determinar semver de forma mecánica.
- **Gitflow simplificado** (sin `develop`) se adapta al equipo pequeño y al ciclo de releases con GitHub Releases (que dispara `publish.yaml` — ver [ADR 0006](0006-ci-cd-docker-runtime-config.md)).
- **Título repetido** en el cuerpo garantiza que el squash-merge message incluye el contexto completo.

## Alternativas

- **Trunk-based sin gitflow:** más simple pero pierde trazabilidad por tipo de cambio.
- **Gitflow completo con `develop`:** innecesariamente complejo para un equipo de 1-3 personas.

## Consecuencias

- Toda rama se crea con prefijo de tipo antes de trabajar, con `--no-track`.
- Todo PR generado por IA sigue esta plantilla (título en primera línea del cuerpo).
- El título del PR es también el mensaje del squash-merge commit.
- Los commits **no** incluyen trailer `Co-Authored-By` — el usuario es autor único.

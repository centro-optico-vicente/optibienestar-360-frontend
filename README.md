# optisalud-plus-frontend

Admin + multi-portal SPA del ecosistema **OptiSalud Plus / Centro Óptico Vicente**.
Nuxt 4 (SPA, `ssr: false`) + Nuxt UI + Tailwind CSS + Pinia.

**Parte del ecosistema:** [centro-optico-vicente](https://github.com/fenix-core/centro-optico-vicente) (hub maestro)

## Local clone setup (one-time)

After cloning the repo, activate the versioned git hooks **once per clone**:

```bash
git config core.hooksPath .githooks
```

This enables the `pre-push` hook that blocks direct pushes to `main` per the
**regla cero** in [ADR 0007](.ai/decisions/0007-pr-and-branch-conventions.md):
all changes must enter `main` via a Pull Request from a `feature/`, `fix/`,
`refactor/`, `chore/` or `hotfix/` branch. Server-side branch protection is
paid-only on private GitHub repos and would violate
[ADR 0004 — Only free tools](https://github.com/fenix-core/centro-optico-vicente/blob/main/.ai/decisions/0004-only-free-tools.md),
so the hook is the free, client-side fallback. Bypass is `git push --no-verify`
(reserve for genuine emergencies). See [`.githooks/README.md`](.githooks/README.md) for details.

## Run (local)

```bash
pnpm install
pnpm dev          # http://localhost:3000

pnpm typecheck    # vue-tsc strict
pnpm generate     # static SPA into .output/public/
```

## Environment variables

This is a static SPA (`ssr: false`), so there is **no server runtime** to read
env vars in production. The backend API base URL is resolved in two ways:

- **Local dev:** `NUXT_PUBLIC_API_BASE_URL` from a `.env` file feeds
  `runtimeConfig.public.apiBaseUrl` (see [`.env.example`](.env.example)).
- **Container:** the Docker image renders `/config.js` from the environment at
  startup (entrypoint), so a single image serves any environment without a
  rebuild — see [ADR 0006](.ai/decisions/0006-ci-cd-docker-runtime-config.md).

| Variable | Default | Description |
|---|---|---|
| `NUXT_PUBLIC_API_BASE_URL` | `https://api.centroopticovicente.com` (`.env.example`) · `https://api-test.centroopticovicente.com` (Docker image) | Base URL of the backend REST API (no trailing slash). Override per environment with `-e NUXT_PUBLIC_API_BASE_URL=...`. The image default points to **test** so an unconfigured container never hits production. |

## Docker image

Multi-stage build (`pnpm generate` → Nginx serving the static SPA), `alpine` and
`debian` flavours, published to Docker Hub
`fenixcoreenterprises/optisalud-plus-frontend` on GitHub Release. See
[`docker/`](docker/) and [ADR 0006](.ai/decisions/0006-ci-cd-docker-runtime-config.md).

## Documentation

AI-assistance docs live in [`.ai/`](.ai/). **Start at [`.ai/CLAUDE.md`](.ai/CLAUDE.md)**.
For cross-stack decisions see the hub master:
[centro-optico-vicente/.ai](https://github.com/fenix-core/centro-optico-vicente/tree/main/.ai).

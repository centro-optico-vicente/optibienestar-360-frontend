#!/usr/bin/env node
/**
 * Generates `app/types/api.d.ts` from the OpenAPI contract the backend publishes with every release
 * (ADR LOC-0011). Nothing generated is committed: `api/contract-version` pins the backend release whose
 * contract this frontend consumes, and this script downloads that release's `openapi.json` asset and
 * turns it into TypeScript types with `openapi-typescript` (types only, no runtime client).
 *
 * Usage:
 *   pnpm api:generate                          # contract of the release pinned in api/contract-version
 *   API_CONTRACT_FILE=/path/openapi.json pnpm api:generate   # a local spec instead (e.g. unreleased backend)
 *
 * The download is cached in `.cache/openapi/<version>/` (git-ignored). Bump the version by editing
 * `api/contract-version` in a PR; the typecheck then shows the mismatches against the new contract.
 *
 * Plain Node (>= 20, global fetch), no dependencies besides openapi-typescript itself.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_FILE = resolve(ROOT, 'api/contract-version');
const OUTPUT = resolve(ROOT, 'app/types/api.d.ts');
const CACHE_DIR = resolve(ROOT, '.cache/openapi');
const CLI = resolve(ROOT, 'node_modules/openapi-typescript/bin/cli.js');
const RELEASES_URL =
  process.env.API_CONTRACT_BASE_URL ??
  'https://github.com/centro-optico-vicente/optibienestar-360-backend/releases/download';

function fail(message) {
  console.error(`api:generate: ${message}`);
  process.exit(1);
}

function readVersion() {
  if (!existsSync(VERSION_FILE)) fail(`${VERSION_FILE} not found`);
  const version = readFileSync(VERSION_FILE, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`api/contract-version must look like 0.0.121, got "${version}"`);
  return version;
}

function assertOpenApi(path) {
  let spec;
  try {
    spec = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path} is not valid JSON (${error.message})`);
  }
  if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.')) {
    fail(`${path} is not an OpenAPI 3.x document`);
  }
}

async function resolveSpec() {
  const local = process.env.API_CONTRACT_FILE;
  if (local) {
    const path = resolve(local);
    if (!existsSync(path)) fail(`API_CONTRACT_FILE not found: ${path}`);
    assertOpenApi(path);
    console.log(`api:generate: using local spec ${path}`);
    return path;
  }

  const version = readVersion();
  const cached = resolve(CACHE_DIR, version, 'openapi.json');
  if (existsSync(cached)) {
    assertOpenApi(cached);
    console.log(`api:generate: contract ${version} (cached)`);
    return cached;
  }

  const url = `${RELEASES_URL}/${version}/openapi.json`;
  console.log(`api:generate: downloading ${url}`);
  let response;
  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch (error) {
    fail(`could not reach ${url} (${error.message})`);
  }
  if (!response.ok) {
    fail(`${url} answered HTTP ${response.status}; does release ${version} exist and carry the openapi.json asset?`);
  }
  mkdirSync(dirname(cached), { recursive: true });
  writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
  assertOpenApi(cached);
  return cached;
}

const spec = await resolveSpec();

if (!existsSync(CLI)) fail('openapi-typescript is not installed; run `pnpm install` first');
mkdirSync(dirname(OUTPUT), { recursive: true });
const result = spawnSync(process.execPath, [CLI, spec, '--output', OUTPUT], { stdio: 'inherit', cwd: ROOT });
if (result.status !== 0) fail('openapi-typescript failed');
console.log(`api:generate: wrote ${OUTPUT}`);

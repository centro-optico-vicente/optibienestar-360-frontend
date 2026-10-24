#!/usr/bin/env node
// Verifies that the UI locale bundles stay in sync (vertical-11, Fase 5):
//   1. Same set of keys in every bundle (a key in es.json must exist in en.json and vice versa).
//   2. Same kind of value per key (a leaf string in one bundle can't be an object in the other).
//   3. No empty translations.
//   4. Same named placeholders per message ({name}, {count}, ...), so a typo in a
//      variable doesn't silently render as literal text in one language.
//
// Zero dependencies: runs with plain Node before `pnpm install`.
// Usage: node scripts/check-i18n-parity.mjs   (exit code 1 on any mismatch)

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'i18n', 'locales')
const REFERENCE = 'es' // Source of truth for UI copy (specs/06-i18n.md)
const OTHERS = ['en']

// Named interpolation: {name}. Literal escapes like {'@'} are not placeholders.
const PLACEHOLDER = /\{\s*([A-Za-z_]\w*)\s*\}/g

function load(code) {
  const file = join(LOCALES_DIR, `${code}.json`)
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  catch (err) {
    console.error(`✖ Cannot read or parse ${file}: ${err.message}`)
    process.exit(1)
  }
}

/** Flattens a nested bundle into `{ 'a.b.c': value }`, keeping objects/arrays as leaves only when empty. */
function flatten(node, prefix = '', out = new Map()) {
  if (node !== null && typeof node === 'object') {
    const entries = Array.isArray(node) ? node.map((v, i) => [String(i), v]) : Object.entries(node)
    if (entries.length === 0) out.set(prefix, node)
    for (const [key, value] of entries) flatten(value, prefix ? `${prefix}.${key}` : key, out)
  }
  else {
    out.set(prefix, node)
  }
  return out
}

function placeholders(value) {
  if (typeof value !== 'string') return []
  return [...new Set([...value.matchAll(PLACEHOLDER)].map(m => m[1]))].sort()
}

const reference = flatten(load(REFERENCE))
const errors = []

for (const [key, value] of reference) {
  if (value === '') errors.push(`${REFERENCE}: empty translation for "${key}"`)
}

for (const code of OTHERS) {
  const other = flatten(load(code))

  for (const key of reference.keys()) {
    if (!other.has(key)) errors.push(`${code}: missing key "${key}" (present in ${REFERENCE})`)
  }
  for (const [key, value] of other) {
    if (!reference.has(key)) {
      errors.push(`${code}: extra key "${key}" (missing in ${REFERENCE})`)
      continue
    }
    const refValue = reference.get(key)
    if (typeof value !== typeof refValue) {
      errors.push(`${code}: "${key}" is ${typeof value} but ${typeof refValue} in ${REFERENCE}`)
      continue
    }
    if (value === '') errors.push(`${code}: empty translation for "${key}"`)
    const a = placeholders(refValue).join(', ')
    const b = placeholders(value).join(', ')
    if (a !== b) errors.push(`${code}: placeholders differ for "${key}": ${REFERENCE} {${a}} vs ${code} {${b}}`)
  }
}

if (errors.length > 0) {
  console.error(`✖ i18n parity check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(`✔ i18n parity OK: ${reference.size} keys in ${[REFERENCE, ...OTHERS].join(', ')}`)

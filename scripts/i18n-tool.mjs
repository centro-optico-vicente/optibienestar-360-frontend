#!/usr/bin/env node
// Reads and edits the UI locale bundles (i18n/locales/{es,en}.json) by key, so neither a
// person nor an AI assistant has to open the ~300 KB files to change one message.
//
// Zero dependencies. Files are rewritten as JSON.stringify(…, null, 2) + '\n', which is
// their current format, so a change only touches the edited lines.
//
// Usage:
//   node scripts/i18n-tool.mjs get <key>                 value or subtree in es + en
//   node scripts/i18n-tool.mjs keys <prefix>             leaf keys under a prefix (es)
//   node scripts/i18n-tool.mjs find <text>               keys whose es/en value contains text (case-insensitive)
//   node scripts/i18n-tool.mjs set <key> <es> <en>       create or replace a leaf in both bundles
//   node scripts/i18n-tool.mjs rm <key>                  delete a key (leaf or subtree) from both bundles
//   node scripts/i18n-tool.mjs mv <fromKey> <toKey>      move/rename a key in both bundles
//
// Keys are dot paths (`members.list.title`). Remember to escape a literal @ as {'@'}.
// Afterwards: node scripts/check-i18n-parity.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'i18n', 'locales')
const LOCALES = ['es', 'en']

const fileOf = code => join(LOCALES_DIR, `${code}.json`)
const load = code => JSON.parse(readFileSync(fileOf(code), 'utf8'))
const save = (code, data) => writeFileSync(fileOf(code), `${JSON.stringify(data, null, 2)}\n`)

function lookup(root, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), root)
}

function parentOf(root, key, create) {
  const parts = key.split('.')
  const last = parts.pop()
  let node = root
  for (const part of parts) {
    if (node[part] === undefined && create) node[part] = {}
    if (node[part] === null || typeof node[part] !== 'object') return [undefined, last]
    node = node[part]
  }
  return [node, last]
}

/** Removes objects left empty along `key` after a delete, deepest first. */
function pruneEmpty(root, key) {
  const parts = key.split('.').slice(0, -1)
  while (parts.length) {
    const [parent, last] = parentOf(root, parts.join('.'), false)
    if (!parent || Object.keys(parent[last] ?? { x: 1 }).length) return
    delete parent[last]
    parts.pop()
  }
}

function leaves(node, prefix, out = []) {
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) leaves(value, prefix ? `${prefix}.${key}` : key, out)
  }
  else {
    out.push([prefix, node])
  }
  return out
}

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const [command, ...args] = process.argv.slice(2)
const bundles = Object.fromEntries(LOCALES.map(code => [code, load(code)]))

switch (command) {
  case 'get': {
    for (const code of LOCALES) console.log(`[${code}]`, JSON.stringify(lookup(bundles[code], args[0]), null, 2))
    break
  }
  case 'keys': {
    for (const [key] of leaves(lookup(bundles.es, args[0]), args[0])) console.log(key)
    break
  }
  case 'find': {
    const needle = (args[0] ?? '').toLowerCase()
    const matches = new Set()
    for (const code of LOCALES) {
      for (const [key, value] of leaves(bundles[code], '')) {
        if (String(value).toLowerCase().includes(needle)) matches.add(key)
      }
    }
    for (const key of matches) console.log(`${key}\n  es: ${lookup(bundles.es, key)}\n  en: ${lookup(bundles.en, key)}`)
    break
  }
  case 'set': {
    const [key, es, en] = args
    if (!key || es === undefined || en === undefined) fail('usage: set <key> <es> <en>')
    for (const [code, value] of [['es', es], ['en', en]]) {
      const [parent, last] = parentOf(bundles[code], key, true)
      if (!parent) fail(`${code}: a parent of "${key}" is a string, not an object`)
      if (parent[last] !== null && typeof parent[last] === 'object') fail(`${code}: "${key}" is a subtree; refusing to overwrite it`)
      parent[last] = value
      save(code, bundles[code])
    }
    console.log(`✔ set ${key}`)
    break
  }
  case 'rm': {
    for (const code of LOCALES) {
      const [parent, last] = parentOf(bundles[code], args[0], false)
      if (parent && last in parent) {
        delete parent[last]
        pruneEmpty(bundles[code], args[0])
        save(code, bundles[code])
      }
    }
    console.log(`✔ removed ${args[0]}`)
    break
  }
  case 'mv': {
    const [from, to] = args
    if (!from || !to) fail('usage: mv <fromKey> <toKey>')
    for (const code of LOCALES) {
      const [source, sourceKey] = parentOf(bundles[code], from, false)
      if (!source || !(sourceKey in source)) fail(`${code}: "${from}" not found`)
      const [target, targetKey] = parentOf(bundles[code], to, true)
      if (!target) fail(`${code}: a parent of "${to}" is a string`)
      if (targetKey in target) fail(`${code}: "${to}" already exists`)
      target[targetKey] = source[sourceKey]
      delete source[sourceKey]
      pruneEmpty(bundles[code], from)
    }
    for (const code of LOCALES) save(code, bundles[code])
    console.log(`✔ moved ${from} → ${to}`)
    break
  }
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 19).join('\n'))
    process.exit(command ? 1 : 0)
}

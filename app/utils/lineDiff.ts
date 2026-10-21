/**
 * Line-by-line diff between two texts (longest common subsequence), for the
 * "Cambios" tab of the terms acceptance modal: what changed between the
 * contract the user accepted before and the one they are asked to accept now.
 *
 * Kept in-house (no `diff` dependency) — contracts are a few hundred lines, so
 * the O(n·m) table is cheap once the common prefix/suffix is trimmed.
 */

export type LineDiffKind = 'added' | 'removed' | 'unchanged'

export interface LineDiffPart {
  kind: LineDiffKind
  text: string
}

/** Above this many table cells the middle block is shown as removed + added instead of aligned. */
const MAX_CELLS = 4_000_000

function splitLines(text: string | null | undefined): string[] {
  if (!text) return []
  return text.replace(/\r\n?/g, '\n').split('\n')
}

export function lineDiff(before: string | null | undefined, after: string | null | undefined): LineDiffPart[] {
  const a = splitLines(before)
  const b = splitLines(after)

  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const parts: LineDiffPart[] = a.slice(0, start).map(text => ({ kind: 'unchanged' as const, text }))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  if (midA.length * midB.length > MAX_CELLS) {
    parts.push(...midA.map(text => ({ kind: 'removed' as const, text })))
    parts.push(...midB.map(text => ({ kind: 'added' as const, text })))
  }
  else {
    parts.push(...lcsDiff(midA, midB))
  }

  parts.push(...a.slice(endA).map(text => ({ kind: 'unchanged' as const, text })))
  return parts
}

/** Classic LCS table walk; removals are listed before additions inside each changed block. */
function lcsDiff(a: string[], b: string[]): LineDiffPart[] {
  const n = a.length
  const m = b.length
  const width = m + 1
  // lengths[i * width + j] = LCS length of a[i..] and b[j..]
  const lengths = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i * width + j] = a[i] === b[j]
        ? lengths[(i + 1) * width + j + 1]! + 1
        : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!)
    }
  }

  const parts: LineDiffPart[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      parts.push({ kind: 'unchanged', text: a[i]! })
      i++
      j++
    }
    else if (lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!) {
      parts.push({ kind: 'removed', text: a[i]! })
      i++
    }
    else {
      parts.push({ kind: 'added', text: b[j]! })
      j++
    }
  }
  while (i < n) parts.push({ kind: 'removed', text: a[i++]! })
  while (j < m) parts.push({ kind: 'added', text: b[j++]! })
  return parts
}

/** Whether the diff has any added or removed line. */
export function hasLineChanges(parts: LineDiffPart[]): boolean {
  return parts.some(part => part.kind !== 'unchanged')
}

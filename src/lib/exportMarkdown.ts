import { db, Block } from '@/db/schema'

// Legacy per-block converter. Still used as a fallback for pages that
// never migrated to the TipTap `document` block format. Field names
// match the Block interface in src/db/schema.ts exactly.
function blockToMarkdown(block: Block): string {
  const content = block.content ?? ''
  switch (block.type) {
    case 'heading1': return `# ${content}`
    case 'heading2': return `## ${content}`
    case 'heading3': return `### ${content}`
    case 'bullet':   return `- ${content}`
    case 'numbered': return `1. ${content}`
    case 'todo':     return `- [${block.checked ? 'x' : ' '}] ${content}`
    case 'code':     return '```\n' + content + '\n```'
    case 'quote':    return `> ${content}`
    case 'divider':  return `---`
    case 'callout':  return `> 💡 ${content}`
    default:         return content
  }
}

// TipTap JSON node shape — kept loose so the walker tolerates unknown
// node types from future extensions.
interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

// Extract inline text (honoring bold/italic/code/strike/link marks)
// from a `text` node or a tree of inline children.
function inlineText(node: TipTapNode): string {
  if (node.type === 'text') {
    let text = node.text ?? ''
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') text = `**${text}**`
      else if (mark.type === 'italic') text = `*${text}*`
      else if (mark.type === 'code') text = '`' + text + '`'
      else if (mark.type === 'strike') text = `~~${text}~~`
      else if (mark.type === 'link') {
        const href = (mark.attrs?.href as string | undefined) ?? ''
        text = `[${text}](${href})`
      }
    }
    return text
  }
  if (node.type === 'hardBreak') return '  \n'
  if (node.content) return node.content.map(inlineText).join('')
  return ''
}

function tableToMd(table: TipTapNode): string {
  const rows = (table.content ?? []).filter(r => r.type === 'tableRow')
  if (rows.length === 0) return ''
  const cellText = (cell: TipTapNode) =>
    (cell.content ?? []).map(c => blockToMd(c, 0)).join(' ').replace(/\|/g, '\\|').trim()
  const headerCells = (rows[0].content ?? []).map(cellText)
  const separator = headerCells.map(() => '---')
  const bodyRows = rows.slice(1).map(r => (r.content ?? []).map(cellText))
  return [
    `| ${headerCells.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...bodyRows.map(r => `| ${r.join(' | ')} |`),
  ].join('\n')
}

// Convert a single TipTap block node into a markdown string. `depth`
// is only used for indenting nested list items.
function blockToMd(node: TipTapNode, depth = 0): string {
  const indent = '  '.repeat(depth)
  switch (node.type) {
    case 'paragraph':
      return (node.content ?? []).map(inlineText).join('')
    case 'heading': {
      const level = (node.attrs?.level as number | undefined) ?? 1
      const hashes = '#'.repeat(Math.min(6, Math.max(1, level)))
      return `${hashes} ${(node.content ?? []).map(inlineText).join('')}`
    }
    case 'bulletList':
      return (node.content ?? [])
        .map(item => {
          const inner = (item.content ?? [])
            .map(c => blockToMd(c, depth + 1))
            .join('\n')
            .trimStart()
          return `${indent}- ${inner}`
        })
        .join('\n')
    case 'orderedList':
      return (node.content ?? [])
        .map((item, i) => {
          const inner = (item.content ?? [])
            .map(c => blockToMd(c, depth + 1))
            .join('\n')
            .trimStart()
          return `${indent}${i + 1}. ${inner}`
        })
        .join('\n')
    case 'taskList':
      return (node.content ?? [])
        .map(item => {
          const checked = item.attrs?.checked ? 'x' : ' '
          const inner = (item.content ?? [])
            .map(c => blockToMd(c, depth + 1))
            .join('\n')
            .trimStart()
          return `${indent}- [${checked}] ${inner}`
        })
        .join('\n')
    case 'blockquote':
      return (node.content ?? [])
        .map(c => blockToMd(c, depth))
        .join('\n\n')
        .split('\n')
        .map(l => `> ${l}`)
        .join('\n')
    case 'codeBlock': {
      const language = (node.attrs?.language as string | undefined) ?? ''
      const text = (node.content ?? []).map(c => c.text ?? '').join('')
      return '```' + language + '\n' + text + '\n```'
    }
    case 'horizontalRule':
      return '---'
    case 'callout':
      return '> 💡 ' + (node.content ?? []).map(c => blockToMd(c, depth)).join('\n\n')
    case 'table':
      return tableToMd(node)
    case 'database':
      return '[Database]'
    case 'toggle': {
      const title = (node.attrs?.title as string | undefined) ?? 'Toggle'
      const body = (node.content ?? []).map(c => blockToMd(c, depth)).join('\n\n')
      return `<details><summary>${title}</summary>\n\n${body}\n\n</details>`
    }
    case 'listItem':
    case 'taskItem':
      return (node.content ?? []).map(c => blockToMd(c, depth)).join('\n')
    case 'hardBreak':
      return '  \n'
    case 'text':
      return inlineText(node)
    default:
      return inlineText(node)
  }
}

function tiptapToMarkdown(doc: TipTapNode): string {
  if (!doc || !doc.content) return ''
  return doc.content
    .map(c => blockToMd(c, 0))
    .filter(s => s !== '')
    .join('\n\n')
}

export async function exportPageToMarkdown(
  pageUid: string,
  pageTitle: string
): Promise<void> {
  const blocks = await db.blocks
    .where('pageUid')
    .equals(pageUid)
    .sortBy('order')

  // Prefer the TipTap `document` block if present — this is the
  // canonical storage format after the legacy-blocks migration runs
  // on page load. Fall back to the legacy per-block converter for
  // any pages that still hold unmigrated rows.
  let body = ''
  const docBlock = blocks.find(b => b.type === 'document')
  if (docBlock) {
    try {
      const doc = JSON.parse(docBlock.content) as TipTapNode
      body = tiptapToMarkdown(doc)
    } catch {
      body = ''
    }
  } else {
    body = blocks
      .filter(b => b.type !== 'document')
      .map(blockToMarkdown)
      .filter(line => line !== '')
      .join('\n\n')
  }

  const lines: string[] = [`# ${pageTitle || 'Untitled'}`, '']
  if (body) lines.push(body)
  const markdown = lines.join('\n\n')

  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(pageTitle || 'untitled').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
  a.click()
  URL.revokeObjectURL(url)
}

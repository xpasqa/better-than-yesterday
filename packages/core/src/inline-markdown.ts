// Outline renders exactly five inline patterns as React nodes — never
// dangerouslySetInnerHTML, so a pasted `<img onerror=…>` has no way to
// execute (2.outline/spec.md §6). This is deliberately not a general
// markdown parser: unmatched markers (an unclosed `**`) are left as literal
// text rather than guessed at, since a wrong guess here is a rendering bug
// a full-strength parser wouldn't have room to introduce.
export type InlineSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strike'; text: string }
  | { type: 'link'; text: string; url: string }

const PATTERN =
  /(\*\*(.+?)\*\*)|(~~(.+?)~~)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))|(\*(?!\*)([^*]+?)\*(?!\*))/g

export function parseInlineMarkdown(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let lastIndex = 0
  PATTERN.lastIndex = 0

  for (let match = PATTERN.exec(text); match !== null; match = PATTERN.exec(text)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }

    if (match[1] !== undefined) segments.push({ type: 'bold', text: match[2]! })
    else if (match[3] !== undefined) segments.push({ type: 'strike', text: match[4]! })
    else if (match[5] !== undefined) segments.push({ type: 'code', text: match[6]! })
    else if (match[7] !== undefined) segments.push({ type: 'link', text: match[8]!, url: match[9]! })
    else if (match[10] !== undefined) segments.push({ type: 'italic', text: match[11]! })

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return segments
}

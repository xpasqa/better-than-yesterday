// Sanitasi HTML badan email dengan isomorphic-dompurify.
// Lapis ketiga (<iframe sandbox>) ada di frontend (Blok G).
import createDOMPurify from 'isomorphic-dompurify'
import { JSDOM } from 'jsdom'

const window = new JSDOM('').window
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DOMPurify = createDOMPurify(window as any)

// Blokir remote image: pindahkan src/srcset/background/poster ke data-blocked-*
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const attrs = ['src', 'srcset', 'background', 'poster'] as const
  for (const attr of attrs) {
    if (node.hasAttribute(attr)) {
      node.setAttribute(`data-blocked-${attr}`, node.getAttribute(attr) ?? '')
      node.removeAttribute(attr)
    }
  }
})

export function sanitizeMailHtml(raw: string): string {
  if (!raw) return ''
  return DOMPurify.sanitize(raw, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: [],
    ALLOW_DATA_ATTR: true,  // perlu untuk data-blocked-*
    FORCE_BODY: true,
  })
}

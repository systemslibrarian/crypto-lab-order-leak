const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

/**
 * Escape a value before it is interpolated into one of this app's HTML
 * template strings.
 *
 * The DBA panel's status line is built from control values -- the population
 * select among them -- and rendered with innerHTML, which is the sink CodeQL
 * named for js/xss-through-dom. A single character-class replace is used so
 * there is no ordering question: `&` cannot be escaped twice.
 */
export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character])
}

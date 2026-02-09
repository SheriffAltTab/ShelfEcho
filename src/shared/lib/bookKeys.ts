/**
 * Normalize an OpenLibrary book key for use in URLs.
 * OpenLibrary keys look like "/works/OL12345W" - we strip the leading slash
 * so they can be used safely in browser URLs and API paths.
 */
export function normalizeKey(key: string): string {
  return key.replace(/^\//, '');
}

/**
 * Build a navigation path for a book details page.
 */
export function bookPath(key: string): string {
  return `/book/${normalizeKey(key)}`;
}

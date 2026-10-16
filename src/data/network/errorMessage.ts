/** Read heterogeneous HTTP/Error payloads without calling string methods on objects. */
export function errorMessageText(value: unknown, depth = 0): string {
  if (depth > 4) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Error) return errorMessageText(value.message, depth + 1);
  if (Array.isArray(value)) return value.map(item => errorMessageText(item, depth + 1)).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const body = value as { message?: unknown; messages?: unknown };
    return errorMessageText(body.message, depth + 1) || errorMessageText(body.messages, depth + 1);
  }
  return '';
}

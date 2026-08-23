const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

export function resolvePublicMediaUrl(
  url: string | undefined | null,
  publicUrl: string,
): string {
  const value = (url ?? '').trim();
  if (!value) return '';

  const base = (publicUrl || '').trim().replace(/\/$/, '');
  if (!base) return value;

  if (/^https?:\/\//i.test(value)) {
    if (LOCALHOST_ORIGIN.test(value)) {
      try {
        return value.replace(/^https?:\/\/[^/]+/i, base);
      } catch {
        return value;
      }
    }
    return value;
  }

  if (value.startsWith('/')) {
    return `${base}${value}`;
  }

  return value;
}

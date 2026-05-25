/**
 * Next リダイレクト先 URL をサニタイズする。
 * - searchParams 由来の string | string[] | undefined を受け付ける
 * - 外部 URL・プロトコル相対 URL への open redirect を防ぐ
 */
export function sanitizeNext(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}
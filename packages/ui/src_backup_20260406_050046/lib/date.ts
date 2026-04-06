/**
 * ISO 8601 文字列を日本語ロケールの読みやすい形式に整形する
 * 例: "2026-04-03T12:00:00.000Z" → "2026/04/03 21:00"
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 日付のみ表示（時刻なし）
 * 例: "2026-04-03T12:00:00.000Z" → "2026/04/03"
 */
export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

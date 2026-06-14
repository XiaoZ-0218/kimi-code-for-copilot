/**
 * Shared utility helpers used across the extension.
 */

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/**
 * Escape special HTML characters to prevent XSS when interpolating
 * untrusted strings into HTML templates.
 */
export function escapeHtml(value: unknown): string {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape characters that have special meaning in Markdown (especially
 * command links and HTML) so API-returned strings cannot inject
 * `command:` links or arbitrary HTML into MarkdownString tooltips.
 */
export function escapeMarkdown(value: unknown): string {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d${hours}h${String(minutes).padStart(2, '0')}m`;
  }
  return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

/**
 * Fetch wrapper with a default timeout to prevent requests from hanging
 * indefinitely when the network or server is unresponsive.
 */
export function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, ...rest } = init ?? {};
  const abortSignal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

  const mergedInit: RequestInit = {
    ...rest,
    signal: rest.signal && abortSignal
      ? AbortSignal.any([rest.signal, abortSignal])
      : (rest.signal ?? abortSignal),
  };

  return fetch(input, mergedInit);
}

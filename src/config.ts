import * as vscode from 'vscode';

function getConfig() {
  return vscode.workspace.getConfiguration('kimi-code-copilot');
}

export function getDebugLoggingEnabled(): boolean {
  return getConfig().get('debug', false);
}

/**
 * Validate that the configured base URL uses HTTPS and is parseable.
 * Returns the normalized URL or throws a user-facing error.
 */
export function getBaseUrl(): string {
  const configured = getConfig().get('baseUrl', 'https://api.kimi.com/coding/v1').trim();
  const baseUrl = configured || 'https://api.kimi.com/coding/v1';
  const normalized = baseUrl.replace(/\/+$/, '');

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(
      `Kimi Code baseUrl 格式无效: ${baseUrl}。请在设置中修改为有效的 HTTPS URL。`,
    );
  }

  if (url.protocol !== 'https:') {
    throw new Error(
      `Kimi Code baseUrl 必须使用 HTTPS 协议: ${baseUrl}。请修改设置以保障 API Key 安全。`,
    );
  }

  return normalized;
}

export function getApiUrl(path: string): string {
  const base = getBaseUrl();
  const normalizedPath = path.replace(/^\/+/, '');

  // Default base URL already ends with /v1, but callers also pass /v1/...
  // Avoid producing .../v1/v1/...
  if (base.endsWith('/v1') && normalizedPath.startsWith('v1/')) {
    return new URL(normalizedPath.slice(3), `${base}/`).toString();
  }

  return new URL(normalizedPath, `${base}/`).toString();
}

export function getModelId(): string {
  return getConfig().get('modelId', 'kimi-for-coding');
}

export function getMaxTokens(): number {
  return getConfig().get('maxTokens', 0);
}

export function getUsageRefreshInterval(): number {
  return getConfig().get('usageRefreshInterval', 30);
}

export function getDisplayRefreshInterval(): number {
  return getConfig().get('displayRefreshInterval', 1);
}

export function getDashboardAllowLan(): boolean {
  return getConfig().get('dashboard.allowLan', false);
}

export function getDashboardAccessToken(): string {
  return getConfig().get('dashboard.accessToken', '').trim();
}

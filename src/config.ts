import * as vscode from 'vscode';

function getConfig() {
  return vscode.workspace.getConfiguration('kimi-code-copilot');
}

export function getDebugLoggingEnabled(): boolean {
  return getConfig().get('debug', false);
}

export function getBaseUrl(): string {
  const configured = getConfig().get('baseUrl', 'https://api.kimi.com/coding/v1').trim();
  const baseUrl = configured || 'https://api.kimi.com/coding/v1';
  return baseUrl.replace(/\/+$/, '');
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

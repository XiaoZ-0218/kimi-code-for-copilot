import * as vscode from 'vscode';
import { getApiUrl } from './config';
import { logger } from './logger';

const SECRET_KEY = 'kimi-code-copilot.apiKey';
const VALIDATION_PATHS = ['/v1/models'];

export class AuthManager {
  constructor(private context: vscode.ExtensionContext) {}

  async hasApiKey(): Promise<boolean> {
    const key = await this.context.secrets.get(SECRET_KEY);
    return !!key;
  }

  async getApiKey(): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_KEY);
  }

  async promptForApiKey(): Promise<boolean> {
    const existing = await this.context.secrets.get(SECRET_KEY);
    const key = await vscode.window.showInputBox({
      title: 'Kimi Code API Key',
      prompt: 'Paste your Kimi Code API key from https://www.kimi.com/code/console',
      password: true,
      value: existing,
      placeHolder: 'sk-...',
      ignoreFocusOut: true,
    });

    if (key === undefined) return false;

    const trimmed = key.trim();
    if (!trimmed) {
      vscode.window.showWarningMessage('API key is required.');
      return false;
    }

    const failureReason = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Validating Kimi Code API key…',
      },
      async () => validateApiKey(trimmed),
    );

    if (failureReason !== null) {
      const choice = await vscode.window.showWarningMessage(
        `API key validation warning: ${failureReason}`,
        { modal: false },
        'Save anyway',
        'Cancel',
      );
      if (choice !== 'Save anyway') {
        return false;
      }
    }

    await this.context.secrets.store(SECRET_KEY, trimmed);
    vscode.window.showInformationMessage(
      failureReason === null
        ? 'Kimi Code API key validated and saved.'
        : 'Kimi Code API key saved (validation had warnings).',
    );
    return true;
  }

  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
  }
}

async function validateApiKey(apiKey: string): Promise<string | null> {
  for (const path of VALIDATION_PATHS) {
    try {
      const url = getApiUrl(path);
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (res.ok) return null;

      if (res.status === 401) return 'Invalid API key (401 Unauthorized)';
      if (res.status === 402) return 'Insufficient balance or quota (402)';
      if (res.status === 429) return 'Rate limited (429) — try again in a moment';
      if (res.status === 404) continue; // Try next path

      return `Unexpected ${res.status} ${res.statusText}`;
    } catch (e) {
      return `Network error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return null; // All paths 404 — may still work for chat
}

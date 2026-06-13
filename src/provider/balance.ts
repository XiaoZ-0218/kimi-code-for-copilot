import * as vscode from 'vscode';
import { logger } from '../logger';
import { getApiUrl } from '../config';
import type { KimiBalance, SessionUsage } from '../types';

function freshSession(): SessionUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    requestCount: 0,
    startTime: Date.now(),
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export class BalanceTracker {
  private balance: KimiBalance | null = null;
  private session: SessionUsage = freshSession();
  private autoRefreshTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private statusBar: vscode.StatusBarItem,
    private getApiKey: () => Promise<string | undefined>,
    private userAgent: string,
  ) {
    this.updateStatusBar();
  }

  recordUsage(model: string, usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) {
    this.session.promptTokens += usage.prompt_tokens ?? 0;
    this.session.completionTokens += usage.completion_tokens ?? 0;
    this.session.requestCount += 1;
    logger.info(
      `usage model=${model} prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens} reqCount=${this.session.requestCount}`,
    );
    this.updateStatusBar();
    this.scheduleSilentBalanceRefresh();
  }

  async refreshBalance(silent = false) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      if (!silent) {
        vscode.window.showWarningMessage('Set your Kimi Code API key first (Command Palette → Kimi Code: Set API Key).');
      }
      return;
    }

    try {
      // Try the Kimi platform balance endpoint
      const url = getApiUrl('/v1/users/me/balance');
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': this.userAgent,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.warn(`Balance fetch failed: ${res.status} ${text.slice(0, 200)}`);
        if (!silent) {
          vscode.window.showWarningMessage(
            `Kimi Code 用量查询失败: HTTP ${res.status}。请在控制台查看: https://www.kimi.com/code/console`,
          );
        }
        return;
      }

      const data = (await res.json()) as {
        available?: boolean;
        total_balance?: number;
        total_used?: number;
        total_granted?: number;
        currency?: string;
      };

      this.balance = {
        available: data.available ?? true,
        totalBalance: data.total_balance,
        totalUsed: data.total_used,
        totalGranted: data.total_granted,
        currency: data.currency,
        fetchedAt: Date.now(),
      };

      this.updateStatusBar();

      if (!silent) {
        const sym = this.balance.currency === 'CNY' ? '¥' : '$';
        void vscode.window.setStatusBarMessage(
          `$(check) Kimi Code 余额: ${sym}${this.balance.totalBalance?.toFixed(2) ?? 'N/A'}`,
          4000,
        );
      }
    } catch (e) {
      logger.warn('Balance fetch error', e);
      if (!silent) {
        vscode.window.showErrorMessage(
          `Kimi Code 用量查询失败: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  refreshDisplay() {
    this.updateStatusBar();
  }

  private scheduleSilentBalanceRefresh() {
    if (this.autoRefreshTimer) clearTimeout(this.autoRefreshTimer);
    this.autoRefreshTimer = setTimeout(() => {
      this.autoRefreshTimer = undefined;
      void this.refreshBalance(true);
    }, 1500);
  }

  clearSession() {
    this.session = freshSession();
    this.updateStatusBar();
    vscode.window.showInformationMessage('Kimi Code 会话计数器已清零。');
  }

  private updateStatusBar() {
    const parts: string[] = [];

    // Session usage
    const totalTokens = this.session.promptTokens + this.session.completionTokens;
    if (totalTokens > 0) {
      parts.push(`$(pulse) ${formatNumber(totalTokens)} tok`);
    }

    // Balance info from API
    if (this.balance?.totalBalance !== undefined) {
      const sym = this.balance.currency === 'CNY' ? '¥' : '$';
      parts.push(`$(credit-card) ${sym}${this.balance.totalBalance.toFixed(2)}`);
    }

    if (parts.length === 0) {
      parts.push(`$(kebab-horizontal) Kimi Code`);
    }

    this.statusBar.text = parts.join(' ');
    this.statusBar.tooltip = this.buildTooltip();
    this.statusBar.show();
  }

  private buildTooltip(): string {
    const lines: string[] = ['**Kimi Code for Copilot**', ''];

    // Session stats
    if (this.session.requestCount > 0) {
      lines.push('── 本次会话 ──');
      lines.push(`请求数: ${this.session.requestCount}`);
      lines.push(`Prompt Tokens: ${formatNumber(this.session.promptTokens)}`);
      lines.push(`Completion Tokens: ${formatNumber(this.session.completionTokens)}`);
      lines.push(
        `总计 Tokens: ${formatNumber(this.session.promptTokens + this.session.completionTokens)}`,
      );
      lines.push(`已用时间: ${formatDuration(Date.now() - this.session.startTime)}`);
      lines.push('');
    }

    // Platform balance
    if (this.balance?.totalBalance !== undefined) {
      const sym = this.balance.currency === 'CNY' ? '¥' : '$';
      lines.push('── Kimi Code 用量 ──');
      lines.push(`剩余: ${sym}${this.balance.totalBalance.toFixed(2)}`);
      if (this.balance.totalUsed !== undefined) {
        lines.push(`已用: ${sym}${this.balance.totalUsed.toFixed(2)}`);
      }
      if (this.balance.fetchedAt) {
        const time = new Date(this.balance.fetchedAt).toLocaleTimeString();
        lines.push(`更新: ${time}`);
      }
      lines.push('');
    }

    lines.push('── 快捷操作 ──');
    lines.push('点击打开管理菜单');
    lines.push('查看控制台: https://www.kimi.com/code/console');

    return lines.join('\n');
  }

  // ── Getters for dashboard ──

  getSession(): SessionUsage {
    return { ...this.session };
  }

  getBalance(): KimiBalance | null {
    return this.balance ? { ...this.balance } : null;
  }

  // ── Private helpers ──
  dispose() {
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = undefined;
    }
    this.statusBar.dispose();
  }
}

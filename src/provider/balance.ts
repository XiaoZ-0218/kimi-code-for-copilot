import * as vscode from 'vscode';
import { logger } from '../logger';
import { getApiUrl } from '../config';
import type { KimiUsage, KimiUsageTier, SessionUsage } from '../types';

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
  return String(Math.round(n));
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export class BalanceTracker {
  private usage: KimiUsage | null = null;
  private session: SessionUsage = freshSession();
  private usageFetchTimer: ReturnType<typeof setTimeout> | undefined;
  private displayTimer: ReturnType<typeof setInterval> | undefined;

  /** API refresh interval in ms (default 30s) */
  private apiRefreshMs = 30_000;
  /** Display refresh interval in ms (default 1s) */
  private displayRefreshMs = 1_000;

  /** Dashboard state */
  private dashboardRunning = false;
  private dashboardPort = 0;
  private dashboardLanUrl = '';

  constructor(
    private statusBar: vscode.StatusBarItem,
    private getApiKey: () => Promise<string | undefined>,
    private userAgent: string,
  ) {
    this.updateStatusBar();
    this.startDisplayTimer();
    // Fetch usage right away
    void this.refreshBalance(true);
  }

  // ── Refresh intervals ──

  setApiRefreshInterval(ms: number) {
    this.apiRefreshMs = Math.max(5_000, ms);
  }

  setDisplayRefreshInterval(ms: number) {
    this.displayRefreshMs = Math.max(500, ms);
    if (this.displayTimer) {
      clearInterval(this.displayTimer);
      this.displayTimer = setInterval(() => this.updateStatusBar(), this.displayRefreshMs);
    }
  }

  private startDisplayTimer() {
    if (this.displayTimer) clearInterval(this.displayTimer);
    this.displayTimer = setInterval(() => this.updateStatusBar(), this.displayRefreshMs);
  }

  // ── Dashboard state ──

  setDashboardRunning(running: boolean, port?: number, lanUrl?: string) {
    this.dashboardRunning = running;
    this.dashboardPort = port ?? 0;
    this.dashboardLanUrl = lanUrl ?? '';
    this.updateStatusBar();
  }

  // ── Usage recording ──

  recordUsage(model: string, usageData: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) {
    this.session.promptTokens += usageData.prompt_tokens ?? 0;
    this.session.completionTokens += usageData.completion_tokens ?? 0;
    this.session.requestCount += 1;
    logger.info(
      `usage model=${model} prompt=${usageData.prompt_tokens} completion=${usageData.completion_tokens} total=${usageData.total_tokens} reqCount=${this.session.requestCount}`,
    );
    // Immediate display update; API refresh is debounced
    this.updateStatusBar();
    this.scheduleApiRefresh();
  }

  // ── Kimi Code usage API ──

  async refreshBalance(silent = false) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      if (!silent) {
        vscode.window.showWarningMessage('请先设置 Kimi Code API Key（命令面板 → Kimi Code: Set API Key）');
      }
      return;
    }

    try {
      const url = getApiUrl('/v1/usages');
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.warn(`用量查询失败: ${res.status} ${text.slice(0, 200)}`);
        if (!silent) {
          vscode.window.showWarningMessage(
            `Kimi Code 用量查询失败: HTTP ${res.status}。请在控制台查看: https://www.kimi.com/code/console`,
          );
        }
        return;
      }

      this.usage = parseKimiUsage(await res.json());
      this.updateStatusBar();

      if (!silent && this.usage) {
        void vscode.window.setStatusBarMessage(
          `$(check) Kimi Code [${this.usage.copilotPlan}] 剩余 ${this.usage.premium.remaining}/${this.usage.premium.entitlement}`,
          4000,
        );
      }
    } catch (e) {
      logger.warn('用量查询异常', e);
      if (!silent) {
        vscode.window.showErrorMessage(`Kimi Code 用量查询失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  refreshDisplay() {
    this.updateStatusBar();
  }

  private scheduleApiRefresh() {
    if (this.usageFetchTimer) clearTimeout(this.usageFetchTimer);
    this.usageFetchTimer = setTimeout(() => {
      this.usageFetchTimer = undefined;
      void this.refreshBalance(true);
    }, this.apiRefreshMs);
  }

  clearSession() {
    this.session = freshSession();
    this.updateStatusBar();
    vscode.window.showInformationMessage('Kimi Code 会话计数器已清零。');
  }

  // ── Status bar ──

  private updateStatusBar() {
    const parts: string[] = [];

    // Dashboard takes priority
    if (this.dashboardRunning) {
      parts.push(`$(radio-tower) Kimi :${this.dashboardPort}`);
      this.statusBar.text = parts.join(' ');
      this.statusBar.tooltip = this.buildTooltip();
      this.statusBar.show();
      return;
    }

    // Always show plan + remaining (compact)
    if (this.usage) {
      const rem = this.usage.premium.remaining;
      const ent = this.usage.premium.entitlement;
      parts.push(`$(credit-card) ${rem}/${ent}`);
    } else {
      parts.push('$(key) Kimi');
    }

    // Session token count
    const totalTok = this.session.promptTokens + this.session.completionTokens;
    if (totalTok > 0) {
      parts.push(`$(pulse) ${formatNumber(totalTok)}`);
    }

    this.statusBar.text = parts.join(' ');
    this.statusBar.tooltip = this.buildTooltip();
    this.statusBar.show();
  }

  private buildTooltip(): string {
    const lines: string[] = ['**Kimi Code for Copilot**', ''];

    // Dashboard
    if (this.dashboardRunning) {
      lines.push('── 📡 看板运行中 ──');
      lines.push(`端口: ${this.dashboardPort}`);
      if (this.dashboardLanUrl) lines.push(`局域网: ${this.dashboardLanUrl}`);
      lines.push('');
    }

    // API key status
    lines.push(this.usage ? '$(check) API Key 已配置' : '$(warning) 未设置 API Key');
    lines.push('');

    // Plan usage
    if (this.usage) {
      lines.push(`── ${this.usage.copilotPlan} 套餐 ──`);
      for (const tier of this.usage.tiers) {
        const bar = renderBar(tier.utilization);
        const detail = tier.limit ? ` (${tier.used}/${tier.limit})` : '';
        lines.push(`${tier.label}: ${bar} ${Math.round(tier.utilization)}%${detail}`);
      }
      if (this.usage.premium.entitlement > 0 && this.usage.tiers.length === 0) {
        lines.push(`Premium: ${this.usage.premium.remaining}/${this.usage.premium.entitlement}`);
      }
      lines.push(`重置日期: ${this.usage.quotaResetDate}`);
      const fetchTime = new Date(this.usage.fetchedAt).toLocaleTimeString();
      lines.push(`数据更新: ${fetchTime}`);
      lines.push('');
    }

    // Session
    if (this.session.requestCount > 0) {
      lines.push('── 本次会话 ──');
      lines.push(`请求: ${this.session.requestCount}`);
      lines.push(`输入: ${formatNumber(this.session.promptTokens)} tok · 输出: ${formatNumber(this.session.completionTokens)} tok`);
      lines.push(`耗时: ${formatDuration(Date.now() - this.session.startTime)}`);
      lines.push('');
    } else {
      lines.push('── 本次会话 ──');
      lines.push('暂无活动');
      lines.push('');
    }

    lines.push('点击打开管理菜单');
    lines.push('控制台: https://www.kimi.com/code/console');
    return lines.join('\n');
  }

  // ── Getters ──

  getSession(): SessionUsage {
    return { ...this.session };
  }

  getUsage(): KimiUsage | null {
    return this.usage ? { ...this.usage, tiers: [...this.usage.tiers] } : null;
  }

  dispose() {
    if (this.displayTimer) clearInterval(this.displayTimer);
    if (this.usageFetchTimer) clearTimeout(this.usageFetchTimer);
    this.statusBar.dispose();
  }
}

// ── Kimi API response parser ──

interface KimiUsageRaw {
  copilot_plan?: string;
  quota_reset_date?: string;
  quota_snapshots?: {
    premium_interactions?: { entitlement?: number; remaining?: number };
  };
  usage?: Array<{
    limit?: number;
    remaining?: number;
    resetTime?: string;
    period_limit?: number;
    period_remaining?: number;
  }>;
}

function parseKimiUsage(raw: KimiUsageRaw): KimiUsage {
  const premium = raw.quota_snapshots?.premium_interactions ?? {};
  const tiers: KimiUsageTier[] = [];

  for (const item of raw.usage ?? []) {
    if (item.limit !== undefined && item.limit > 0) {
      const remaining = item.remaining ?? 0;
      const used = item.limit - remaining;
      tiers.push({
        name: 'weekly',
        utilization: (used / item.limit) * 100,
        label: '周额度',
        used,
        limit: item.limit,
        resetsAt: item.resetTime,
      });
    }
    if (item.period_limit !== undefined && item.period_limit > 0) {
      const remaining = item.period_remaining ?? 0;
      const used = item.period_limit - remaining;
      tiers.push({
        name: '5hour',
        utilization: (used / item.period_limit) * 100,
        label: '5小时窗口',
        used,
        limit: item.period_limit,
      });
    }
  }

  if (tiers.length === 0 && premium.entitlement && premium.entitlement > 0) {
    const remaining = premium.remaining ?? 0;
    const used = premium.entitlement - remaining;
    tiers.push({
      name: 'premium',
      utilization: (used / premium.entitlement) * 100,
      label: 'Premium 请求',
      used,
      limit: premium.entitlement,
      resetsAt: raw.quota_reset_date,
    });
  }

  return {
    copilotPlan: raw.copilot_plan ?? 'Unknown',
    quotaResetDate: raw.quota_reset_date ?? 'N/A',
    premium: {
      entitlement: premium.entitlement ?? 0,
      remaining: premium.remaining ?? 0,
    },
    tiers,
    fetchedAt: Date.now(),
  };
}

function renderBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}


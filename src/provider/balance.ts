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
      logger.debug(`[usage] GET ${url}`);
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
    // Dashboard takes priority
    if (this.dashboardRunning) {
      this.statusBar.text = `$(radio-tower) KIMI :${this.dashboardPort}`;
      this.statusBar.tooltip = this.buildTooltip();
      this.statusBar.show();
      return;
    }

    if (!this.usage) {
      this.statusBar.text = '$(sparkle) KIMI';
      this.statusBar.tooltip = this.buildTooltip();
      this.statusBar.show();
      return;
    }

    const windowTier = findWindowTier(this.usage.tiers);
    if (windowTier) {
      // API returns integer used/limit; the percentage is derived from them.
      // Status bar uses integer % for compactness; tooltip keeps the raw count.
      const pct = String(Math.round(windowTier.utilization));
      const resetMs = windowTier.resetsAt ? new Date(windowTier.resetsAt).getTime() - Date.now() : 0;
      const resetText = formatCountdown(resetMs);
      this.statusBar.text = `$(sparkle) KIMI · 5h · ${pct}% · ${resetText}`;
    } else {
      // Fallback: show premium remaining
      const rem = this.usage.premium.remaining;
      const ent = this.usage.premium.entitlement;
      this.statusBar.text = `$(sparkle) KIMI ${rem}/${ent}`;
    }

    this.statusBar.tooltip = this.buildTooltip();
    this.statusBar.show();
  }

  private buildTooltip(): vscode.MarkdownString {
    const sections: string[] = [];

    // Header
    sections.push('### 🧠 Kimi Code for Copilot');
    sections.push(this.usage ? '✅ API Key 已配置' : '⚠️ 未设置 API Key');
    sections.push('');

    // Dashboard
    if (this.dashboardRunning) {
      sections.push('---');
      sections.push('**📡 用量看板运行中**');
      sections.push(`- 端口：${this.dashboardPort}`);
      if (this.dashboardLanUrl) {
        sections.push(`- 局域网：${this.dashboardLanUrl}`);
      }
      sections.push('');
    }

    // Plan usage
    if (this.usage) {
      sections.push('---');

      const windowTier = findWindowTier(this.usage.tiers);
      const weeklyEnt = this.usage.premium.entitlement;
      const weeklyRem = this.usage.premium.remaining;
      const weeklyUsed = weeklyEnt - weeklyRem;
      const weeklyPct = weeklyEnt > 0 ? (weeklyUsed / weeklyEnt) * 100 : 0;

      // 5h window
      if (windowTier) {
        const pct = Math.round(windowTier.utilization);
        const resetMs = windowTier.resetsAt ? new Date(windowTier.resetsAt).getTime() - Date.now() : 0;
        sections.push('**5h 频限**');
        sections.push(`${renderBar(windowTier.utilization)} ${pct}% · 重置 ${formatCountdown(resetMs)}`);
        sections.push('');
      }

      // Weekly usage
      if (weeklyEnt > 0) {
        const remainingWindows = windowTier?.limit ? weeklyRem / windowTier.limit : 0;
        const pct = Math.round(weeklyPct);
        const resetMs = this.usage.quotaResetDate !== 'N/A' ? new Date(this.usage.quotaResetDate).getTime() - Date.now() : 0;
        sections.push('**本周用量**');
        sections.push(`${renderBar(weeklyPct)} ${pct}% · 重置 ${formatCountdown(resetMs)}`);
        sections.push(`本周还剩 ${remainingWindows.toFixed(1)} 个 5h`);
        sections.push('');
      }

      if (this.usage.quotaResetDate !== 'N/A') {
        sections.push(`下次重置：${formatDateTime(new Date(this.usage.quotaResetDate))}`);
      }
      sections.push(`数据更新：${formatDateTime(new Date(this.usage.fetchedAt))}`);
      sections.push('');
    }

    // Session
    sections.push('---');
    sections.push('**📊 本次会话**');
    if (this.session.requestCount > 0) {
      sections.push('| 指标 | 数值 |');
      sections.push('|---:|---:|');
      sections.push(`| 请求次数 | ${this.session.requestCount} |`);
      sections.push(`| 输入 Tokens | ${formatNumber(this.session.promptTokens)} |`);
      sections.push(`| 输出 Tokens | ${formatNumber(this.session.completionTokens)} |`);
      sections.push(`| 总计 Tokens | ${formatNumber(this.session.promptTokens + this.session.completionTokens)} |`);
      sections.push(`| 已用时间 | ${formatDuration(Date.now() - this.session.startTime)} |`);
    } else {
      sections.push('暂无活动');
    }
    sections.push('');

    // Footer
    sections.push('---');
    sections.push(`[🔄 刷新用量](command:kimi-code-copilot.refreshUsage) · [打开控制台](https://www.kimi.com/code/console)`);

    const md = new vscode.MarkdownString(sections.join('\n'));
    md.supportHtml = true;
    md.isTrusted = true;
    return md;
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
  /** Primary quota (string-encoded numbers from Kimi). */
  usage?: {
    limit?: string;
    remaining?: string;
    resetTime?: string;
  };
  /** Windowed rate/concurrency limits. */
  limits?: Array<{
    window?: { duration?: number; timeUnit?: string };
    detail?: {
      limit?: string;
      used?: string;
      remaining?: string;
      resetTime?: string;
    };
  }>;
  /** Overall quota. */
  totalQuota?: {
    limit?: string;
    remaining?: string;
  };
}

function toNum(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatWindowLabel(window?: { duration?: number; timeUnit?: string }): string {
  const duration = window?.duration ?? 0;
  const unit = window?.timeUnit ?? '';
  if (duration <= 0) return '窗口额度';
  if (unit.includes('MINUTE')) return `${duration} 分钟窗口`;
  if (unit.includes('HOUR')) return `${duration} 小时窗口`;
  if (unit.includes('DAY')) return `${duration} 天窗口`;
  return `${duration} 窗口`;
}

function parseKimiUsage(raw: KimiUsageRaw): KimiUsage {
  const primary = raw.usage ?? {};
  const total = raw.totalQuota ?? {};

  // Prefer the primary quota for the top-level premium display.
  let entitlement = toNum(primary.limit);
  let remaining = toNum(primary.remaining);
  const quotaResetDate = primary.resetTime ?? 'N/A';

  // Fall back to totalQuota if primary is missing.
  if (entitlement <= 0) {
    entitlement = toNum(total.limit);
    remaining = toNum(total.remaining);
  }

  const tiers: KimiUsageTier[] = [];

  for (const item of raw.limits ?? []) {
    const detail = item.detail ?? {};
    const limit = toNum(detail.limit);
    if (limit <= 0) continue;

    const used = toNum(detail.used);
    tiers.push({
      name: 'window',
      utilization: (used / limit) * 100,
      label: formatWindowLabel(item.window),
      used,
      limit,
      resetsAt: detail.resetTime,
    });
  }

  if (entitlement > 0 && tiers.length === 0) {
    const used = entitlement - remaining;
    tiers.push({
      name: 'premium',
      utilization: (used / entitlement) * 100,
      label: 'Premium 请求',
      used,
      limit: entitlement,
      resetsAt: quotaResetDate,
    });
  }

  return {
    copilotPlan: 'Kimi Code',
    quotaResetDate,
    premium: { entitlement, remaining },
    tiers,
    fetchedAt: Date.now(),
  };
}

function renderBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h00m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function findWindowTier(tiers: KimiUsageTier[]): KimiUsageTier | undefined {
  // Prefer the 5-hour (300-minute) window; fall back to any window tier.
  return tiers.find((t) => t.name === 'window' && t.resetsAt) ?? tiers.find((t) => t.name === 'window');
}


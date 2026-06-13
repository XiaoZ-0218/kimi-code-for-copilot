import * as http from 'node:http';
import * as os from 'node:os';
import { logger } from '../logger';
import type { KimiBalance, SessionUsage } from '../types';

export interface DashboardData {
  session: SessionUsage;
  balance: KimiBalance | null;
  serverUrl: string;
  startTime: number;
}

function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const list = addrs as os.NetworkInterfaceInfo[];
    for (const addr of list) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push(addr.address);
      }
    }
  }
  return ips;
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

function renderPage(data: DashboardData): string {
  const { session, balance } = data;
  const totalTokens = session.promptTokens + session.completionTokens;
  const elapsed = Date.now() - session.startTime;
  const sym = balance?.currency === 'CNY' ? '¥' : '$';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Kimi Code 用量看板</title>
<style>
  :root {
    --bg: #0f0f14;
    --card: #1a1a24;
    --accent: #6366f1;
    --accent2: #8b5cf6;
    --text: #e4e4e7;
    --muted: #71717a;
    --green: #22c55e;
    --orange: #f59e0b;
    --red: #ef4444;
    --radius: 16px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px;
  }
  .container {
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .header {
    text-align: center;
    padding: 8px 0;
  }
  .header h1 {
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header p {
    color: var(--muted);
    font-size: 13px;
    margin-top: 4px;
  }
  .card {
    background: var(--card);
    border-radius: var(--radius);
    padding: 20px;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .card-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    margin-bottom: 12px;
    font-weight: 600;
  }
  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { color: var(--muted); font-size: 14px; }
  .stat-value {
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .stat-value.big {
    font-size: 28px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .balance-positive { color: var(--green); }
  .balance-warning { color: var(--orange); }
  .balance-low { color: var(--red); }
  .progress-bar {
    height: 6px;
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    margin-top: 8px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    border-radius: 3px;
    transition: width 1s ease;
  }
  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
  }
  .tag-active { background: rgba(34,197,94,0.15); color: var(--green); }
  .tag-info { background: rgba(99,102,241,0.15); color: var(--accent); }
  .footer {
    text-align: center;
    color: var(--muted);
    font-size: 12px;
    margin-top: 8px;
  }
  .refreshing {
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f4f4f9;
      --card: #ffffff;
      --text: #1a1a24;
      --muted: #8e8e99;
    }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🧠 Kimi Code</h1>
    <p>用量看板 · <span class="refreshing" id="status">实时</span></p>
  </div>

  <!-- Session Card -->
  <div class="card">
    <div class="card-title">📊 本次会话</div>
    <div class="stat-row">
      <span class="stat-label">请求次数</span>
      <span class="stat-value">${session.requestCount}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Prompt Tokens</span>
      <span class="stat-value">${formatNumber(session.promptTokens)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Completion Tokens</span>
      <span class="stat-value">${formatNumber(session.completionTokens)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">总计 Tokens</span>
      <span class="stat-value big">${formatNumber(totalTokens)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">已用时间</span>
      <span class="stat-value">${formatDuration(elapsed)}</span>
    </div>
  </div>

  <!-- Balance Card -->
  ${balance?.totalBalance !== undefined ? `
  <div class="card">
    <div class="card-title">💰 平台余额</div>
    <div class="stat-row">
      <span class="stat-label">剩余额度</span>
      <span class="stat-value big ${balance.totalBalance > 10 ? 'balance-positive' : balance.totalBalance > 1 ? 'balance-warning' : 'balance-low'}">${sym}${balance.totalBalance.toFixed(2)}</span>
    </div>
    ${balance.totalUsed !== undefined ? `
    <div class="stat-row">
      <span class="stat-label">已用额度</span>
      <span class="stat-value">${sym}${balance.totalUsed.toFixed(2)}</span>
    </div>` : ''}
    ${balance.totalGranted !== undefined ? `
    <div class="progress-bar">
      <div class="progress-fill" style="width:${Math.min(100, ((balance.totalUsed ?? 0) / (balance.totalGranted + (balance.totalUsed ?? 0))) * 100)}%"></div>
    </div>` : ''}
    <div class="stat-row">
      <span class="stat-label">状态</span>
      <span class="tag tag-active">✓ 可用</span>
    </div>
  </div>
  ` : `
  <div class="card">
    <div class="card-title">💰 平台余额</div>
    <div style="text-align:center; padding:20px; color:var(--muted);">
      <p>暂未获取到用量信息</p>
      <p style="font-size:12px; margin-top:8px;">请先在 VS Code 中执行 "刷新用量信息"</p>
    </div>
  </div>
  `}

  <!-- Info -->
  <div class="card">
    <div class="card-title">ℹ️ 信息</div>
    <div class="stat-row">
      <span class="stat-label">模型</span>
      <span class="stat-value tag tag-info">kimi-for-coding</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">控制台</span>
      <a href="https://www.kimi.com/code/console" target="_blank" style="color:var(--accent);text-decoration:none;font-size:14px;">打开 →</a>
    </div>
  </div>

  <div class="footer">
    每 5 秒自动刷新 · Kimi Code for Copilot
  </div>
</div>

<script>
  // Auto-refresh every 5 seconds
  let countdown = 5;
  const statusEl = document.getElementById('status');
  setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      location.reload();
    }
    statusEl.textContent = countdown + 's 后刷新';
  }, 1000);
</script>
</body>
</html>`;
}

export class DashboardServer {
  private server: http.Server | null = null;
  private port = 0;
  private getData: () => DashboardData;

  constructor(getData: () => DashboardData) {
    this.getData = getData;
  }

  async start(): Promise<{ port: number; urls: string[] }> {
    if (this.server) {
      return { port: this.port, urls: this.getUrls() };
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((_req: http.IncomingMessage, res: http.ServerResponse) => {
        try {
          const data = this.getData();
          const html = renderPage(data);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(html);
        } catch (e) {
          logger.error(`Dashboard render error: ${e}`);
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      });

      this.server.on('error', (err: Error) => {
        logger.error(`Dashboard server error: ${err}`);
        reject(err);
      });

      this.server.listen(0, '0.0.0.0', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          const urls = this.getUrls();
          logger.info(`Dashboard server started on port ${this.port}`);
          resolve({ port: this.port, urls });
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        this.port = 0;
        logger.info('Dashboard server stopped');
        resolve();
      });
    });
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.port;
  }

  getUrls(): string[] {
    const ips = getLocalIPs();
    const urls: string[] = [];
    urls.push(`http://localhost:${this.port}`);
    for (const ip of ips) {
      urls.push(`http://${ip}:${this.port}`);
    }
    return urls;
  }
}

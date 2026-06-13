import * as vscode from 'vscode';
import { logger } from './logger';
import { AuthManager } from './auth';
import { KimiCodeChatProvider } from './provider/index';
import { DashboardServer } from './dashboard/server';
import type { DashboardData } from './dashboard/server';
import { getDebugLoggingEnabled } from './config';

let activeProvider: KimiCodeChatProvider | undefined;
let dashboardServer: DashboardServer | undefined;

export function activate(context: vscode.ExtensionContext) {
  const extVersion = context.extension.packageJSON.version;
  const vscodeVersion = vscode.version;
  const userAgent = `kimi-code-for-copilot/${extVersion} VSCode/${vscodeVersion}`;

  logger.setDebugEnabled(getDebugLoggingEnabled());
  logger.info(`Kimi Code for Copilot 启动 version=${extVersion} debug=${getDebugLoggingEnabled()}`);

  // Status bar item: shows session token usage + platform quota
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBar.command = 'kimi-code-copilot.manage';
  statusBar.name = 'Kimi Code';
  statusBar.tooltip = 'Kimi Code for Copilot — 点击管理';
  context.subscriptions.push(statusBar);

  const authManager = new AuthManager(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('kimi-code-copilot.showLogs', () => {
      logger.show();
    }),
    vscode.commands.registerCommand('kimi-code-copilot.getApiKey', () => {
      void vscode.env.openExternal(
        vscode.Uri.parse('https://www.kimi.com/code/console'),
      );
    }),
    vscode.commands.registerCommand('kimi-code-copilot.openConsole', () => {
      void vscode.env.openExternal(
        vscode.Uri.parse('https://www.kimi.com/code/console'),
      );
    }),
  );

  // Create provider
  try {
    const provider = new KimiCodeChatProvider(
      context,
      authManager,
      statusBar,
      userAgent,
    );
    activeProvider = provider;

    // Dashboard server - data provider function
    const getDashboardData = (): DashboardData => ({
      session: provider.balanceTracker.getSession(),
      balance: provider.balanceTracker.getBalance(),
      serverUrl: dashboardServer?.isRunning()
        ? `http://localhost:${dashboardServer.getPort()}`
        : '未启动',
      startTime: Date.now(),
    });

    dashboardServer = new DashboardServer(getDashboardData);

    // Dashboard start command
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'kimi-code-copilot.startDashboard',
        async () => {
          if (dashboardServer!.isRunning()) {
            const urls = dashboardServer!.getUrls();
            const picked = await vscode.window.showInformationMessage(
              `用量看板已在运行`,
              { modal: false },
              '打开看板',
              '停止看板',
            );
            if (picked === '打开看板') {
              await vscode.env.openExternal(vscode.Uri.parse(urls[0]));
            } else if (picked === '停止看板') {
              await dashboardServer!.stop();
              provider.balanceTracker.setDashboardRunning(false);
            }
            return;
          }

          try {
            const { port, urls } = await dashboardServer!.start();
            const localUrl = urls[0];
            const lanUrl = urls.length > 1 ? urls[1] : localUrl;

            provider.balanceTracker.setDashboardRunning(true, port, lanUrl);

            const picked = await vscode.window.showInformationMessage(
              `用量看板已启动！用手机扫码或浏览器打开`,
              { modal: false },
              '打开看板',
              '复制局域网地址',
            );

            if (picked === '打开看板') {
              await vscode.env.openExternal(vscode.Uri.parse(localUrl));
            } else if (picked === '复制局域网地址') {
              await vscode.env.clipboard.writeText(lanUrl);
              void vscode.window.showInformationMessage(`已复制: ${lanUrl}`);
            }
          } catch (e) {
            void vscode.window.showErrorMessage(
              `启动看板失败: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        },
      ),
    );

    // Dashboard stop command
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'kimi-code-copilot.stopDashboard',
        async () => {
          if (!dashboardServer?.isRunning()) {
            void vscode.window.showInformationMessage('用量看板未在运行');
            return;
          }
          await dashboardServer.stop();
          provider.balanceTracker.setDashboardRunning(false);
          void vscode.window.showInformationMessage('用量看板已停止');
        },
      ),
    );

    // Management command
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'kimi-code-copilot.manage',
        async () => {
          const dashboardRunning = dashboardServer?.isRunning();
          const picked = await vscode.window.showQuickPick(
            [
              {
                label: '$(key) 设置 API Key',
                id: 'setApiKey',
                description: '从 Kimi Code 控制台获取',
              },
              {
                label: '$(trash) 清除 API Key',
                id: 'clearApiKey',
              },
              {
                label: '$(refresh) 刷新用量信息',
                id: 'refreshBalance',
                description: '查询 Kimi Code 剩余用量',
              },
              {
                label: '$(clear-all) 清零会话计数器',
                id: 'clearSession',
              },
              dashboardRunning
                ? {
                    label: '$(globe) 打开用量看板',
                    id: 'openDashboard',
                    description: `localhost:${dashboardServer?.getPort()}`,
                  }
                : {
                    label: '$(radio-tower) 启动用量看板',
                    id: 'startDashboard',
                    description: '局域网手机可访问',
                  },
              dashboardRunning
                ? {
                    label: '$(circle-slash) 停止用量看板',
                    id: 'stopDashboard',
                  }
                : undefined,
              {
                label: '$(link-external) 打开 Kimi Code 控制台',
                id: 'openConsole',
                description: '查看详细用量和管理 API Key',
              },
              {
                label: '$(gear) 打开扩展设置',
                id: 'openSettings',
              },
              {
                label: '$(output) 显示日志',
                id: 'showLogs',
              },
            ].filter(Boolean) as { label: string; id: string; description?: string }[],
            {
              title: `管理 Kimi Code for Copilot (v${extVersion})`,
              placeHolder: '选择一个操作',
              matchOnDescription: true,
            },
          );

          switch (picked?.id) {
            case 'setApiKey':
              await provider.configureApiKey();
              break;
            case 'clearApiKey':
              await provider.clearApiKey();
              break;
            case 'refreshBalance':
              await provider.refreshBalance();
              break;
            case 'clearSession':
              provider.clearSession();
              break;
            case 'startDashboard':
            case 'openDashboard':
              await vscode.commands.executeCommand('kimi-code-copilot.startDashboard');
              break;
            case 'stopDashboard':
              await vscode.commands.executeCommand('kimi-code-copilot.stopDashboard');
              break;
            case 'openConsole':
              await vscode.env.openExternal(
                vscode.Uri.parse('https://www.kimi.com/code/console'),
              );
              break;
            case 'openSettings':
              await vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'kimi-code-copilot',
              );
              break;
            case 'showLogs':
              logger.show();
              break;
          }
        },
      ),
    );

    // Register remaining commands on provider
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'kimi-code-copilot.setApiKey',
        async () => {
          await provider.configureApiKey();
        },
      ),
      vscode.commands.registerCommand(
        'kimi-code-copilot.clearApiKey',
        async () => {
          await provider.clearApiKey();
        },
      ),
      vscode.commands.registerCommand(
        'kimi-code-copilot.refreshUsage',
        async () => {
          await provider.refreshBalance();
        },
      ),
      vscode.commands.registerCommand(
        'kimi-code-copilot.clearSession',
        () => {
          provider.clearSession();
        },
      ),
    );

    // Register the LM provider
    context.subscriptions.push(
      vscode.lm.registerLanguageModelChatProvider('kimi-code', provider as vscode.LanguageModelChatProvider<vscode.LanguageModelChatInformation>),
    );

    logger.info('Kimi Code for Copilot 就绪');
  } catch (error) {
    logger.error(`启动失败: ${error}`);
    void vscode.window.showErrorMessage(
      `Kimi Code for Copilot 启动失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function deactivate() {
  void dashboardServer?.stop();
  void activeProvider?.prepareForDeactivate();
  logger.info('Kimi Code for Copilot 已停用');
  logger.dispose();
}

import * as vscode from 'vscode';
import { logger } from './logger';
import { AuthManager } from './auth';
import { KimiCodeChatProvider } from './provider/index';
import { getDebugLoggingEnabled } from './config';

let activeProvider: KimiCodeChatProvider | undefined;

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

    // Management command
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'kimi-code-copilot.manage',
        async () => {
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
            ],
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
  void activeProvider?.prepareForDeactivate();
  logger.info('Kimi Code for Copilot 已停用');
  logger.dispose();
}

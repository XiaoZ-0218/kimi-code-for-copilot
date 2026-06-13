import * as vscode from 'vscode';
import { MODELS, ModelVariant, USAGE_MIME_TYPE } from '../consts';
import { logger } from '../logger';
import { AuthManager } from '../auth';
import { toChatInfo } from './models';
import { prepareChatRequest } from './request';
import { streamChatCompletion } from './stream';
import { BalanceTracker } from './balance';

export class KimiCodeChatProvider implements vscode.LanguageModelChatProvider {
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  onDidChangeLanguageModelChatInformation = this.onDidChangeEmitter.event;

  private isActive = true;
  balanceTracker: BalanceTracker;

  constructor(
    private context: vscode.ExtensionContext,
    private authManager: AuthManager,
    statusBar: vscode.StatusBarItem,
    userAgent: string,
  ) {
    this.balanceTracker = new BalanceTracker(
      statusBar,
      () => this.authManager.getApiKey(),
      userAgent,
    );

    context.subscriptions.push(
      this.onDidChangeEmitter,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('kimi-code-copilot')) {
          this.onDidChangeEmitter.fire();
          this.balanceTracker.refreshDisplay();
        }
      }),
      context.secrets.onDidChange((e) => {
        if (e.key === 'kimi-code-copilot.apiKey') {
          this.onDidChangeEmitter.fire();
          void this.balanceTracker.refreshBalance(true);
        }
      }),
    );

    void this.balanceTracker.refreshBalance(true);
    this.refreshModelPicker();
  }

  // ── Public commands ──

  async configureApiKey(): Promise<boolean> {
    const saved = await this.authManager.promptForApiKey();
    if (saved) this.onDidChangeEmitter.fire();
    return saved;
  }

  async clearApiKey(): Promise<void> {
    await this.authManager.deleteApiKey();
    this.onDidChangeEmitter.fire();
    vscode.window.showInformationMessage('Kimi Code API Key 已移除。');
  }

  async hasApiKey(): Promise<boolean> {
    return this.authManager.hasApiKey();
  }

  refreshModelPicker(): void {
    this.onDidChangeEmitter.fire();
  }

  async refreshBalance(): Promise<void> {
    await this.balanceTracker.refreshBalance(false);
  }

  clearSession(): void {
    this.balanceTracker.clearSession();
  }

  async prepareForDeactivate(): Promise<void> {
    this.isActive = false;
    this.onDidChangeEmitter.fire();
    this.balanceTracker.dispose();
  }

  // ── LM Provider ──

  async provideLanguageModels(
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelChatInformation[]> {
    const hasKey = await this.authManager.hasApiKey();
    return MODELS.map((model) => toChatInfo(model as ModelVariant, hasKey));
  }

  async provideLanguageModelChatResponse(
    modelInfo: vscode.LanguageModelChatInformation,
    messages: vscode.LanguageModelChatMessage[],
    options: vscode.LanguageModelChatRequestOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelChatResponse> {
    if (!this.isActive) {
      throw new Error('Kimi Code provider is deactivating');
    }

    const prepared = await prepareChatRequest({
      authManager: this.authManager,
      modelInfo,
      messages,
      options,
      token,
    });

    logger.info(
      `[req] model=${prepared.model} thinking=${prepared.thinking} messages=${messages.length} chars=${prepared.inputCharCount}`,
    );

    const stream = new vscode.LanguageModelChatResponseStream();
    const self = this;

    streamChatCompletion(
      prepared.url,
      prepared.headers,
      prepared.body,
      {
        onData(chunk: string) {
          stream.addContent(chunk);
        },
        onToolCall(toolCall) {
          stream.addToolCall({
            name: toolCall.name,
            input: toolCall.arguments,
            toolCallId: toolCall.id,
          });
        },
        onComplete(usage) {
          if (usage) {
            stream.addDataPart({ mimeType: USAGE_MIME_TYPE, data: usage });
            self.balanceTracker.recordUsage(prepared.model, usage);
          }
          stream.close();
        },
        onError(error) {
          logger.error(`Stream error: ${error.message}`);
          stream.error(error);
        },
      },
      token,
    ).catch((err) => {
      if (err instanceof vscode.CancellationError) return;
      logger.error(`Unhandled stream error: ${err}`);
    });

    return stream;
  }
}

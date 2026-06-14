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
    private userAgent: string,
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

  // ── LM Provider (VS Code 1.116+ API) ──

  provideLanguageModelChatInformation(
    _options: vscode.PrepareLanguageModelChatModelOptions,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.LanguageModelChatInformation[]> {
    // Return synchronously since we check the key in the background
    return MODELS.map((model) => toChatInfo(model as ModelVariant, true));
  }

  async provideLanguageModelChatResponse(
    modelInfo: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken,
  ): Promise<void> {
    if (!this.isActive) {
      throw new Error('Kimi Code provider is deactivating');
    }

    const prepared = await prepareChatRequest({
      authManager: this.authManager,
      modelInfo,
      messages,
      options,
      token,
      userAgent: this.userAgent,
    });

    logger.info(
      `[req] url=${prepared.url} model=${prepared.model} thinking=${prepared.thinking} messages=${messages.length} chars=${prepared.inputCharCount}`,
    );

    const self = this;

    await streamChatCompletion(
      prepared.url,
      prepared.headers,
      prepared.body,
      {
        onData(chunk: string) {
          progress.report(new vscode.LanguageModelTextPart(chunk));
        },
        onToolCall(toolCall) {
          progress.report(
            new vscode.LanguageModelToolCallPart(
              toolCall.id,
              toolCall.name,
              JSON.parse(toolCall.arguments || '{}'),
            ),
          );
        },
        onComplete(usage) {
          if (usage) {
            const jsonBytes = new TextEncoder().encode(JSON.stringify(usage));
            progress.report(
              new vscode.LanguageModelDataPart(jsonBytes, USAGE_MIME_TYPE),
            );
            self.balanceTracker.recordUsage(prepared.model, usage);
          }
        },
        onError(error) {
          logger.error(`Stream error: ${error.message}`);
          throw error;
        },
      },
      token,
    );
  }

  async provideTokenCount(
    model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    _token: vscode.CancellationToken,
  ): Promise<number> {
    // Simple approximate token counting (4 chars ≈ 1 token for English, 1.5 for Chinese)
    const str = typeof text === 'string' ? text : this.messageToString(text);
    const chineseChars = (str.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = str.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  private messageToString(msg: vscode.LanguageModelChatRequestMessage): string {
    return msg.content
      .map((part) => {
        if (part instanceof vscode.LanguageModelTextPart) return part.value;
        if (part instanceof vscode.LanguageModelToolCallPart)
          return JSON.stringify({ name: part.name, input: part.input });
        if (part instanceof vscode.LanguageModelToolResultPart)
          return part.content.map((c) => (c instanceof vscode.LanguageModelTextPart ? c.value : '')).join('');
        return '';
      })
      .join('');
  }
}

import * as vscode from 'vscode';

const OUTPUT_CHANNEL_NAME = 'Kimi Code for Copilot';

class Logger {
  private channel: vscode.LogOutputChannel | undefined;
  private _debugEnabled = false;

  private getChannel(): vscode.LogOutputChannel {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME, { log: true });
    }
    return this.channel;
  }

  setDebugEnabled(enabled: boolean) {
    this._debugEnabled = enabled;
  }

  info(message: string, ...args: unknown[]) {
    this.getChannel().info(message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.getChannel().warn(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.getChannel().error(message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    if (this._debugEnabled) {
      this.getChannel().debug(message, ...args);
    }
  }

  show() {
    this.getChannel().show(true);
  }

  dispose() {
    this.channel?.dispose();
    this.channel = undefined;
  }
}

export const logger = new Logger();

import * as vscode from 'vscode';
import { logger } from '../logger';

interface StreamCallbacks {
  onData(chunk: string): void;
  onToolCall?(toolCall: {
    id: string;
    name: string;
    arguments: string;
  }): void;
  onComplete(usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }): void;
  onError(error: Error): void;
}

/**
 * Simple SSE stream parser for OpenAI-compatible streaming responses.
 */
export function streamChatCompletion(
  url: string,
  headers: Record<string, string>,
  body: string,
  callbacks: StreamCallbacks,
  token: vscode.CancellationToken,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const abortController = new AbortController();
    const onCancel = token.onCancellationRequested(() => {
      abortController.abort();
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: abortController.signal,
      });

      onCancel.dispose();

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 500)}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

      // Track in-progress tool calls
      const pendingToolCalls = new Map<
        number,
        { id: string; name: string; args: string }
      >();

      while (true) {
        if (token.isCancellationRequested) {
          reader.cancel();
          throw new vscode.CancellationError();
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];

            // Collect usage from stream
            if (parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.prompt_tokens ?? 0,
                completion_tokens: parsed.usage.completion_tokens ?? 0,
                total_tokens: parsed.usage.total_tokens ?? 0,
              };
            }

            if (!choice) continue;

            // Handle text content
            const delta = choice.delta;
            if (delta?.content) {
              callbacks.onData(delta.content);
            }

            // Handle tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!pendingToolCalls.has(idx)) {
                  pendingToolCalls.set(idx, {
                    id: tc.id ?? '',
                    name: tc.function?.name ?? '',
                    args: '',
                  });
                }

                const pending = pendingToolCalls.get(idx)!;
                if (tc.id) pending.id = tc.id;
                if (tc.function?.name) pending.name = tc.function.name;
                if (tc.function?.arguments) pending.args += tc.function.arguments;

                // If we detect the tool call is complete (has id and we have args)
                if (pending.id && pending.name && choice.finish_reason === 'tool_calls') {
                  callbacks.onToolCall?.({
                    id: pending.id,
                    name: pending.name,
                    arguments: pending.args,
                  });
                  pendingToolCalls.delete(idx);
                }
              }
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }

      // Flush any remaining pending tool calls
      for (const [, pending] of pendingToolCalls) {
        if (pending.id && pending.name) {
          callbacks.onToolCall?.({
            id: pending.id,
            name: pending.name,
            arguments: pending.args,
          });
        }
      }

      callbacks.onComplete(usage);
      resolve();
    } catch (error) {
      onCancel.dispose();
      if (error instanceof vscode.CancellationError) {
        reject(error);
      } else {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        reject(error);
      }
    }
  });
}

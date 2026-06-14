import * as vscode from 'vscode';
import { logger } from '../logger';
import { getApiUrl, getModelId, getMaxTokens } from '../config';
import { MAX_TOOLS_PER_REQUEST } from '../consts';

function sanitizeFunctionName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function sanitizeSchema(schema: object): object {
  try {
    const str = JSON.stringify(schema);
    JSON.parse(str);
    return schema;
  } catch {
    return { type: 'object', properties: {} };
  }
}

export interface PreparedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  model: string;
  thinking: boolean;
  stream: boolean;
  inputCharCount: number;
}

export async function prepareChatRequest(params: {
  authManager: { getApiKey(): Promise<string | undefined> };
  modelInfo: { id: string };
  messages: readonly vscode.LanguageModelChatRequestMessage[];
  options: vscode.ProvideLanguageModelChatResponseOptions;
  token: vscode.CancellationToken;
  userAgent: string;
}): Promise<PreparedRequest> {
  const { authManager, modelInfo, messages, options, token, userAgent } = params;

  const apiKey = await authManager.getApiKey();
  if (!apiKey) throw new Error('Kimi Code API key not configured');

  if (token.isCancellationRequested) throw new vscode.CancellationError();

  // Convert VS Code messages to OpenAI format
  const openaiMessages = convertToOpenAIFormat(messages);

  if (openaiMessages.length === 0) {
    throw new Error('No messages to send after conversion');
  }

  // Convert tool definitions
  let tools: object[] | undefined;
  let toolChoice: string | object | undefined;

  if (options.tools && options.tools.length > 0) {
    if (options.tools.length > MAX_TOOLS_PER_REQUEST) {
      throw new Error(`Cannot have more than ${MAX_TOOLS_PER_REQUEST} tools per request.`);
    }

    tools = options.tools
      .filter((t) => t && typeof t === 'object')
      .map((t) => ({
        type: 'function' as const,
        function: {
          name: sanitizeFunctionName(t.name),
          description: t.description || '',
          parameters: sanitizeSchema(t.inputSchema ?? { type: 'object', properties: {} }),
        },
      }));

    toolChoice = 'auto';
    if (options.toolMode === vscode.LanguageModelChatToolMode.Required && tools.length === 1) {
      const tool = tools[0] as { type: string; function: { name: string } };
      toolChoice = { type: 'function', function: { name: tool.function.name } };
    }
  }

  const modelId = getModelId();
  const isThinking = modelInfo.id.includes('::thinking');

  const body: Record<string, unknown> = {
    model: modelId,
    messages: openaiMessages,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
  }

  if (isThinking) {
    body.thinking = { type: 'enabled' };
  } else {
    body.thinking = { type: 'disabled' };
  }

  const requestedTemp = options.modelOptions?.['temperature'];
  if (typeof requestedTemp === 'number') {
    body.temperature = requestedTemp;
  } else if (!isThinking) {
    body.temperature = 0.7;
  }

  const mo = options.modelOptions;
  if (mo) {
    if (typeof mo['top_p'] === 'number') body.top_p = mo['top_p'];
    if (typeof mo['frequency_penalty'] === 'number') body.frequency_penalty = mo['frequency_penalty'];
    if (typeof mo['presence_penalty'] === 'number') body.presence_penalty = mo['presence_penalty'];
    const stopVal = mo['stop'];
    if (typeof stopVal === 'string' || Array.isArray(stopVal)) body.stop = stopVal;
  }

  const configuredMaxTokens = getMaxTokens();
  const maxTokens = configuredMaxTokens > 0 ? configuredMaxTokens : 65536;
  body.max_tokens = maxTokens;

  const inputCharCount = openaiMessages.reduce(
    (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length),
    0,
  );

  return {
    url: getApiUrl('/v1/chat/completions'),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': userAgent,
    },
    body: JSON.stringify(body),
    model: modelId,
    thinking: isThinking,
    stream: true,
    inputCharCount,
  };
}

function convertToOpenAIFormat(
  messages: readonly vscode.LanguageModelChatRequestMessage[],
): Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string; name?: string }> {
  const result: Array<{
    role: string;
    content: string | null;
    tool_calls?: unknown[];
    tool_call_id?: string;
    name?: string;
  }> = [];

  for (const msg of messages) {
    const role = mapRole(msg.role);
    if (!role) continue;

    let content = '';
    const toolCalls: unknown[] = [];
    let toolCallId: string | undefined;
    let toolCallName: string | undefined;

    for (const part of msg.content) {
      if (part instanceof vscode.LanguageModelTextPart) {
        content += part.value;
      } else if (part instanceof vscode.LanguageModelToolCallPart) {
        toolCalls.push({
          id: part.callId,
          type: 'function',
          function: {
            name: part.name,
            arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input),
          },
        });
      } else if (part instanceof vscode.LanguageModelToolResultPart) {
        toolCallId = part.callId;
        content += part.content
          .map((c) => {
            if (c instanceof vscode.LanguageModelTextPart) return c.value;
            return JSON.stringify(c);
          })
          .join('');
      }
    }

    if (toolCalls.length > 0) {
      result.push({ role, content: null, tool_calls: toolCalls });
    } else if (toolCallId) {
      result.push({ role, content: content || '', tool_call_id: toolCallId, name: toolCallName });
    } else {
      result.push({ role, content: content || '' });
    }
  }

  return result;
}

function mapRole(role: vscode.LanguageModelChatMessageRole): string | null {
  switch (role) {
    case vscode.LanguageModelChatMessageRole.User:
      return 'user';
    case vscode.LanguageModelChatMessageRole.Assistant:
      return 'assistant';
    default:
      return null;
  }
}

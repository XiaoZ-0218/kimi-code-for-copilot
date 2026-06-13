import * as vscode from 'vscode';
import { MODELS, ModelVariant, MAX_TOOLS_PER_REQUEST } from '../consts';

const API_KEY_REQUIRED_DETAIL = 'No API key configured. Use "Kimi Code: Manage Provider" or "Kimi Code: Set API Key".';

export function toChatInfo(
  model: ModelVariant,
  hasKey: boolean,
): vscode.LanguageModelChatInformation {
  const tooltip = hasKey
    ? `${model.description}\n\nContext: ${formatTokens(model.maxInputTokens)} in / ${formatTokens(model.maxOutputTokens)} out`
    : API_KEY_REQUIRED_DETAIL;

  const statusIcon = !hasKey
    ? new vscode.ThemeIcon('warning')
    : model.thinking
      ? new vscode.ThemeIcon('lightbulb-sparkle')
      : new vscode.ThemeIcon('rocket');

  const info: vscode.LanguageModelChatInformation = {
    id: model.id,
    name: model.name,
    family: model.family,
    version: model.version,
    detail: hasKey ? model.detail : API_KEY_REQUIRED_DETAIL,
    tooltip,
    maxInputTokens: model.maxInputTokens,
    maxOutputTokens: model.maxOutputTokens,
    isUserSelectable: true,
    statusIcon,
    category: { label: 'Kimi Code', order: 50 },
    capabilities: {
      imageInput: false,
      toolCalling: MAX_TOOLS_PER_REQUEST,
    },
    ...(model.thinking ? { configurationSchema: buildThinkingEffortSchema() } : {}),
  };

  return info;
}

function buildThinkingEffortSchema() {
  return {
    properties: {
      reasoningEffort: {
        type: 'string',
        title: 'Thinking Effort',
        enum: ['medium', 'high'],
        enumItemLabels: ['Medium', 'High'],
        enumDescriptions: [
          'Balanced thinking depth for most tasks.',
          'Maximum reasoning depth for complex problems.',
        ],
        default: 'high',
        group: 'navigation',
      },
    },
  };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function resolveModel(modelId?: string): ModelVariant | undefined {
  return MODELS.find((m) => m.id === modelId);
}

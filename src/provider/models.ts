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

  const info: vscode.LanguageModelChatInformation = {
    id: model.id,
    name: model.name,
    family: model.family,
    version: model.version,
    detail: hasKey ? model.detail : API_KEY_REQUIRED_DETAIL,
    tooltip,
    maxInputTokens: model.maxInputTokens,
    maxOutputTokens: model.maxOutputTokens,
    capabilities: {
      imageInput: false,
      toolCalling: MAX_TOOLS_PER_REQUEST,
    },
  };

  return info;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function resolveModel(modelId?: string): ModelVariant | undefined {
  return MODELS.find((m) => m.id === modelId);
}

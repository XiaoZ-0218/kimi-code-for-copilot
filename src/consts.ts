export const WALKTHROUGH_ID = 'xiaoz.kimi-code-for-copilot#kimiCodeGettingStarted';
export const WELCOME_SHOWN_KEY = 'kimi-code-copilot.welcomeShown';

/** MIME type for reporting API usage to Copilot Chat. */
export const USAGE_MIME_TYPE = 'usage';

/** Max tools per request. */
export const MAX_TOOLS_PER_REQUEST = 128;

/** Kimi Code model definitions. */
export const MODELS = [
  {
    id: 'kimi-for-coding::thinking',
    name: 'Kimi Code (thinking)',
    description: 'Kimi K2.7 Code — strongest coding model with extended thinking, 256K context',
    detail: 'K2.7 Code · thinking · subscription-based',
    vendor: 'kimi-code',
    family: 'kimi-for-coding',
    version: 'thinking',
    maxInputTokens: 196608,
    maxOutputTokens: 65536,
    thinking: true,
  },
  {
    id: 'kimi-for-coding',
    name: 'Kimi Code',
    description: 'Kimi K2.7 Code — fast, no extended thinking, lower latency',
    detail: 'K2.7 Code · fast · subscription-based',
    vendor: 'kimi-code',
    family: 'kimi-for-coding',
    version: 'default',
    maxInputTokens: 196608,
    maxOutputTokens: 65536,
    thinking: false,
  },
] as const;

export type ModelVariant = (typeof MODELS)[number];

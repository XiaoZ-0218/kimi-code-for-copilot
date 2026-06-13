/** Balance/usage info fetched from Kimi Code API. */
export interface KimiBalance {
  /** Whether the API returned valid balance data. */
  available: boolean;
  /** Total granted amount (if pay-per-token). */
  totalGranted?: number;
  /** Total used amount. */
  totalUsed?: number;
  /** Total remaining balance. */
  totalBalance?: number;
  /** Currency (CNY, USD, etc.). */
  currency?: string;
  /** Timestamp of last fetch. */
  fetchedAt?: number;
}

/** Session-level usage tracking. */
export interface SessionUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  requestCount: number;
  /** Tracked from last refresh. */
  startTime: number;
}

/** Pricing tier for a model family. */
export interface PricingTier {
  input: number;
  output: number;
  cacheHit?: number;
}

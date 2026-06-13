/** Kimi Code usage info fetched from GET /v1/usages */
export interface KimiUsage {
  /** Plan name: Andante / Moderato / Allegretto / Allegro */
  copilotPlan: string;
  /** Quota reset date string */
  quotaResetDate: string;
  /** Premium interactions quota */
  premium: {
    entitlement: number;
    remaining: number;
  };
  /** Detailed usage tiers */
  tiers: KimiUsageTier[];
  /** Timestamp of last fetch */
  fetchedAt: number;
}

export interface KimiUsageTier {
  name: string;
  /** Usage percentage 0-100 */
  utilization: number;
  /** Human-readable label */
  label: string;
  /** Current used / limit */
  used?: number;
  limit?: number;
  /** Reset time string */
  resetsAt?: string;
}

/** Balance/usage info fetched from Kimi Code API (legacy - replaced by KimiUsage). */
export interface KimiBalance {
  available: boolean;
  totalGranted?: number;
  totalUsed?: number;
  totalBalance?: number;
  currency?: string;
  fetchedAt?: number;
}

/** Session-level usage tracking. */
export interface SessionUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  requestCount: number;
  startTime: number;
}

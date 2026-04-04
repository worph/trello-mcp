import type { RateLimiter } from "./types.js";

export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.refillInterval = windowMs;
    this.refillRate = maxRequests / windowMs;
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const newTokens = timePassed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  canMakeRequest(): boolean {
    this.refillTokens();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  async waitForAvailableToken(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.canMakeRequest()) {
          resolve();
        } else {
          const tokensNeeded = 1 - this.tokens;
          const msToWait = tokensNeeded / this.refillRate;
          setTimeout(check, Math.min(msToWait, 100));
        }
      };
      check();
    });
  }
}

export function createTrelloRateLimiters() {
  const apiKeyLimiter = new TokenBucketRateLimiter(300, 10000);
  const tokenLimiter = new TokenBucketRateLimiter(100, 10000);

  return {
    apiKeyLimiter,
    tokenLimiter,
    canMakeRequest(): boolean {
      return apiKeyLimiter.canMakeRequest() && tokenLimiter.canMakeRequest();
    },
    async waitForAvailableToken(): Promise<void> {
      await Promise.all([
        apiKeyLimiter.waitForAvailableToken(),
        tokenLimiter.waitForAvailableToken(),
      ]);
    },
  };
}

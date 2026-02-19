/**
 * Shared Groq Rate Limit Manager
 *
 * Global singleton that coordinates Groq API usage across all services
 * (EmotionalFilterService, GroqFactCheckService, etc.) to stay within
 * Groq free tier limits (30 RPM). Capped at 25 RPM for headroom.
 */

class GroqRateLimitManager {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 25, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return this.timestamps.length < this.maxRequests;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  get remaining(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }
}

// Global singleton
let instance: GroqRateLimitManager | null = null;

export function getGroqRateLimitManager(): GroqRateLimitManager {
  if (!instance) {
    instance = new GroqRateLimitManager(25, 60000);
  }
  return instance;
}

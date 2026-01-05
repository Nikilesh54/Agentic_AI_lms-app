import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiter Utility
 * Provides in-memory rate limiting with sliding window
 * For production, consider using Redis for distributed rate limiting
 */

interface RateLimitRecord {
  count: number;
  requests: number[];  // Timestamps of requests
  resetTime: number;
}

class RateLimiter {
  private records: Map<string, RateLimitRecord>;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.records = new Map();

    // Cleanup old records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed under rate limit
   */
  isAllowed(
    identifier: string,
    maxRequests: number,
    windowMs: number,
    useSlidingWindow: boolean = true
  ): { allowed: boolean; resetTime: number; remaining: number } {
    const now = Date.now();
    const record = this.records.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.records.set(identifier, {
        count: 1,
        requests: [now],
        resetTime: now + windowMs
      });

      return {
        allowed: true,
        resetTime: now + windowMs,
        remaining: maxRequests - 1
      };
    }

    if (useSlidingWindow) {
      // Sliding window: count only requests within the time window
      const windowStart = now - windowMs;
      record.requests = record.requests.filter(time => time > windowStart);
      record.count = record.requests.length;

      if (record.count >= maxRequests) {
        return {
          allowed: false,
          resetTime: record.requests[0] + windowMs,
          remaining: 0
        };
      }

      record.requests.push(now);
      record.count++;

      return {
        allowed: true,
        resetTime: record.requests[0] + windowMs,
        remaining: maxRequests - record.count
      };
    } else {
      // Fixed window
      if (record.count >= maxRequests) {
        return {
          allowed: false,
          resetTime: record.resetTime,
          remaining: 0
        };
      }

      record.count++;
      record.requests.push(now);

      return {
        allowed: true,
        resetTime: record.resetTime,
        remaining: maxRequests - record.count
      };
    }
  }

  /**
   * Remove expired records
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [identifier, record] of this.records.entries()) {
      if (now > record.resetTime + 60000) {  // 1 minute grace period
        expired.push(identifier);
      }
    }

    for (const identifier of expired) {
      this.records.delete(identifier);
    }

    if (expired.length > 0) {
      console.log(`Rate limiter: Cleaned up ${expired.length} expired records`);
    }
  }

  /**
   * Clear all records (useful for testing)
   */
  clear(): void {
    this.records.clear();
  }

  /**
   * Get stats
   */
  getStats(): { totalRecords: number; memoryUsage: string } {
    const memoryBytes = JSON.stringify(Array.from(this.records.entries())).length;
    const memoryKB = (memoryBytes / 1024).toFixed(2);

    return {
      totalRecords: this.records.size,
      memoryUsage: `${memoryKB} KB`
    };
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.records.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Express middleware for rate limiting
 */
export function createRateLimitMiddleware(
  maxRequests: number = 60,
  windowMs: number = 60000,
  options: {
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
    handler?: (req: Request, res: Response) => void;
    useSlidingWindow?: boolean;
  } = {}
) {
  const {
    keyGenerator = (req) => req.user?.userId?.toString() || req.ip || 'anonymous',
    skip = () => false,
    handler = (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'You have exceeded the rate limit. Please try again later.'
      });
    },
    useSlidingWindow = true
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if specified
    if (skip(req)) {
      next();
      return;
    }

    const identifier = keyGenerator(req);
    const result = rateLimiter.isAllowed(identifier, maxRequests, windowMs, useSlidingWindow);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());
      handler(req, res);
      return;
    }

    next();
  };
}

/**
 * Rate limiter for AI API calls (not Express middleware)
 */
export class AIRateLimiter {
  private limiter: RateLimiter;
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 20, windowMs: number = 60000) {
    this.limiter = new RateLimiter();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if AI API call is allowed
   */
  async checkLimit(identifier: string): Promise<void> {
    const result = this.limiter.isAllowed(identifier, this.maxRequests, this.windowMs, true);

    if (!result.allowed) {
      const waitTime = Math.ceil((result.resetTime - Date.now()) / 1000);
      throw new Error(`AI API rate limit exceeded. Please wait ${waitTime} seconds.`);
    }
  }

  /**
   * Wait if necessary to respect rate limit
   */
  async waitForSlot(identifier: string): Promise<void> {
    let result = this.limiter.isAllowed(identifier, this.maxRequests, this.windowMs, true);

    while (!result.allowed) {
      const waitTime = result.resetTime - Date.now();
      console.log(`Rate limit reached, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)));
      result = this.limiter.isAllowed(identifier, this.maxRequests, this.windowMs, true);
    }
  }
}

export default rateLimiter;

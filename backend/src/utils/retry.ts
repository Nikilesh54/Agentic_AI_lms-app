import { AI_SERVICE } from '../config/constants';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Initial delay in milliseconds before first retry */
  initialDelayMs?: number;

  /** Maximum delay in milliseconds between retries */
  maxDelayMs?: number;

  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;

  /** Function to determine if an error is retryable */
  isRetryable?: (error: any) => boolean;

  /** Callback called before each retry */
  onRetry?: (error: any, attempt: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: AI_SERVICE.MAX_RETRIES,
  initialDelayMs: AI_SERVICE.INITIAL_RETRY_DELAY_MS,
  maxDelayMs: AI_SERVICE.MAX_RETRY_DELAY_MS,
  backoffMultiplier: AI_SERVICE.RETRY_BACKOFF_MULTIPLIER,
  isRetryable: (error: any) => {
    // Retry on network errors, rate limits, and temporary failures
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    // Retry on HTTP 429 (rate limit) and 5xx errors
    if (error.response?.status === 429 || (error.response?.status >= 500 && error.response?.status < 600)) {
      return true;
    }

    // Don't retry on authentication errors or client errors
    if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 404) {
      return false;
    }

    // Check for Gemini-specific errors
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return true;
    }

    // Default: don't retry unknown errors
    return false;
  },
  onRetry: (error: any, attempt: number) => {
    console.warn(`Retry attempt ${attempt} after error:`, error.message);
  },
};

/**
 * Delay execution for a specified number of milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for next retry using exponential backoff with jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  // Exponential backoff: delay = initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (randomness) to prevent thundering herd
  // Jitter range: 0.5x to 1.5x of calculated delay
  const jitter = 0.5 + Math.random();
  const delayWithJitter = Math.floor(cappedDelay * jitter);

  return delayWithJitter;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function's return value
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => await geminiApi.generateContent(prompt),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      // Try executing the function
      const result = await fn();

      // Success! Return the result
      if (attempt > 1) {
        console.log(`✓ Operation succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = config.isRetryable(error);
      const isLastAttempt = attempt > config.maxRetries;

      if (!shouldRetry || isLastAttempt) {
        // Don't retry this error, or we've exhausted retries
        if (isLastAttempt && shouldRetry) {
          console.error(`✗ All ${config.maxRetries} retry attempts failed`);
        }
        throw error;
      }

      // Calculate delay and notify
      const delayMs = calculateDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.backoffMultiplier
      );

      config.onRetry(error, attempt);
      console.log(`⏳ Waiting ${delayMs}ms before retry ${attempt}/${config.maxRetries}...`);

      // Wait before retrying
      await delay(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Execute multiple functions in parallel with retry logic
 *
 * @param fns - Array of async functions to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to array of results
 *
 * @example
 * ```typescript
 * const results = await retryBatch([
 *   () => api.call1(),
 *   () => api.call2(),
 *   () => api.call3(),
 * ]);
 * ```
 */
export async function retryBatch<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<T[]> {
  return Promise.all(fns.map(fn => retryWithBackoff(fn, options)));
}

/**
 * Execute functions in batches with retry logic
 * Useful for rate-limited APIs
 *
 * @param fns - Array of async functions to execute
 * @param batchSize - Number of functions to execute concurrently
 * @param options - Retry configuration options
 * @returns Promise resolving to array of results
 *
 * @example
 * ```typescript
 * const results = await retryBatchChunked(
 *   [fn1, fn2, fn3, fn4, fn5],
 *   2, // Execute 2 at a time
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryBatchChunked<T>(
  fns: Array<() => Promise<T>>,
  batchSize: number,
  options: RetryOptions = {}
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < fns.length; i += batchSize) {
    const batch = fns.slice(i, i + batchSize);
    const batchResults = await retryBatch(batch, options);
    results.push(...batchResults);

    // Small delay between batches to be nice to the API
    if (i + batchSize < fns.length) {
      await delay(500);
    }
  }

  return results;
}

/**
 * Create a circuit breaker wrapper for a function
 * Stops calling the function after too many failures
 *
 * @param fn - The function to wrap
 * @param options - Circuit breaker options
 * @returns Wrapped function with circuit breaker logic
 */
export function createCircuitBreaker<T>(
  fn: (...args: any[]) => Promise<T>,
  options: {
    /** Number of failures before opening circuit */
    failureThreshold?: number;
    /** Time in ms to wait before trying again */
    resetTimeoutMs?: number;
  } = {}
) {
  const failureThreshold = options.failureThreshold || 5;
  const resetTimeoutMs = options.resetTimeoutMs || 60000; // 1 minute

  let failureCount = 0;
  let lastFailureTime: number | null = null;
  let circuitOpen = false;

  return async (...args: any[]): Promise<T> => {
    // Check if circuit should reset
    if (circuitOpen && lastFailureTime) {
      const timeSinceFailure = Date.now() - lastFailureTime;
      if (timeSinceFailure > resetTimeoutMs) {
        console.log('🔄 Circuit breaker reset - trying again');
        circuitOpen = false;
        failureCount = 0;
      }
    }

    // Circuit is open - fail fast
    if (circuitOpen) {
      throw new Error('Circuit breaker is OPEN - too many failures. Try again later.');
    }

    try {
      const result = await fn(...args);

      // Success - reset failure count
      if (failureCount > 0) {
        console.log('✓ Circuit breaker: Operation succeeded, resetting failure count');
        failureCount = 0;
      }

      return result;
    } catch (error) {
      failureCount++;
      lastFailureTime = Date.now();

      console.error(`⚠️ Circuit breaker: Failure ${failureCount}/${failureThreshold}`);

      if (failureCount >= failureThreshold) {
        circuitOpen = true;
        console.error(`🔴 Circuit breaker OPENED after ${failureCount} failures`);
      }

      throw error;
    }
  };
}

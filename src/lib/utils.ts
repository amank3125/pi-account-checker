/**
 * Utility functions for optimizing API calls
 */

/**
 * Process an array of items in batches to avoid overwhelming APIs
 * @param items Array of items to process
 * @param batchSize Number of items to process at once
 * @param processFn Function to process each batch
 * @param delayMs Delay between batches in milliseconds
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processFn: (batch: T[]) => Promise<R[]>,
  delayMs: number = 500
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processFn(batch);
    results.push(...batchResults);

    // Add delay between batches unless it's the last batch
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// Store debounced function references
const debouncedFunctions = new Map<
  string,
  {
    timer: NodeJS.Timeout;
    lastRun: number;
  }
>();

/**
 * Debounce a function call to prevent rapid successive calls
 * @param key Unique identifier for this debounce operation
 * @param fn Function to be debounced
 * @param waitMs Time to wait before executing in milliseconds
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  key: string,
  fn: T,
  waitMs = 500
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>): void => {
    const existing = debouncedFunctions.get(key);

    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      fn(...args);
      debouncedFunctions.set(key, {
        ...debouncedFunctions.get(key)!,
        lastRun: Date.now(),
      });
    }, waitMs);

    debouncedFunctions.set(key, {
      timer,
      lastRun: existing?.lastRun || 0,
    });
  };
}

// Store throttled function timestamps
const throttledFunctions = new Map<string, number>();

/**
 * Throttle a function to limit the rate of calls
 * @param key Unique identifier for this throttle operation
 * @param fn Function to be throttled
 * @param limitMs Minimum time between function executions
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  key: string,
  fn: T,
  limitMs = 1000
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>): void => {
    const now = Date.now();
    const lastRun = throttledFunctions.get(key) || 0;

    if (now - lastRun >= limitMs) {
      fn(...args);
      throttledFunctions.set(key, now);
    }
  };
}

/**
 * Check if data should be refreshed based on a timestamp
 * @param timestamp Timestamp to check
 * @param maxAgeMs Maximum age in milliseconds
 */
export function shouldRefreshData(
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  return Date.now() - timestamp > maxAgeMs;
}

/**
 * Optimize bulk database operations by grouping them
 * @param items Items to process
 * @param keyExtractor Function to extract a unique key from each item (for deduplication)
 * @param processor Function to process a batch of items
 * @param batchSize Maximum batch size
 * @param delayMs Delay between batches
 */
export async function optimizeBulkOperations<T, K extends string | number>(
  items: T[],
  keyExtractor: (item: T) => K,
  processor: (batch: T[]) => Promise<void>,
  batchSize = 5,
  delayMs = 300
): Promise<void> {
  if (items.length === 0) return;

  // Deduplicate items based on the key
  const uniqueItems = new Map<K, T>();
  items.forEach((item) => {
    const key = keyExtractor(item);
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, item);
    }
  });

  // Convert back to array
  const deduplicatedItems = Array.from(uniqueItems.values());

  // Process in batches
  for (let i = 0; i < deduplicatedItems.length; i += batchSize) {
    const batch = deduplicatedItems.slice(i, i + batchSize);
    await processor(batch);

    // Add delay between batches
    if (i + batchSize < deduplicatedItems.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Perform a batch of queries in parallel with automatic retry logic
 * @param queries Array of query functions
 * @param maxRetries Maximum number of retries for failed queries
 * @param retryDelayMs Delay between retries
 */
export async function batchQueries<T>(
  queries: (() => Promise<T>)[],
  maxRetries = 2,
  retryDelayMs = 500
): Promise<(T | null)[]> {
  return Promise.all(
    queries.map(async (query) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await query();
        } catch (err) {
          if (attempt === maxRetries) {
            console.error("Query failed after retries:", err);
            return null;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
      return null;
    })
  );
}

/**
 * Clears all localStorage data and cache related to the application
 * Call this on logout to ensure user data is removed
 */
export function clearUserData() {
  try {
    // Clear all mining data from localStorage
    localStorage.removeItem("lastMiningDataSync");

    // Clear Supabase session related items
    localStorage.removeItem("supabaseSessionValidation");
    localStorage.removeItem("supabaseSessionValid");
    localStorage.removeItem("supabaseUserData");

    // Clear migration-related items
    localStorage.removeItem("MIGRATION_IN_PROGRESS");
    localStorage.removeItem("MIGRATION_COOLDOWN");
    localStorage.removeItem("lastMigrationTime");
    localStorage.removeItem("lastSessionValidation");
    localStorage.removeItem("hasValidSession");
    localStorage.removeItem("lastSupabaseSync");
    localStorage.removeItem("lastManualSyncAttempt");

    // Clear account cache data
    localStorage.removeItem("cachedAccounts");
    localStorage.removeItem("lastAccountFetchTime");

    // Clear column visibility and sort preferences
    localStorage.removeItem("columnVisibility");
    localStorage.removeItem("sortColumn");
    localStorage.removeItem("sortDirection");

    // Clear sidebar state
    localStorage.removeItem("sidebarExpanded");

    // Clear all cache_ prefixed items (dynamic cache entries)
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("cache_")) {
        localStorage.removeItem(key);
      }
    });

    console.log("All user data cleared from localStorage");

    // If using IndexedDB or other storage, clear those here too

    return true;
  } catch (error) {
    console.error("Error clearing user data:", error);
    return false;
  }
}

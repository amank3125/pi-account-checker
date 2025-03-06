"use client";

import { IDBPDatabase, openDB } from "idb";
import { supabase } from "./supabase";
import { saveAccountSupabase, setCacheDataSupabase } from "./supabase";

// Configuration variables
export const CONFIG = {
  // Enable or disable account import/export functionality
  ENABLE_ACCOUNT_IMPORT_EXPORT: true,
  // Enable or disable Supabase sync
  ENABLE_SUPABASE_SYNC: true,
};

export interface StoredAccount {
  phone_number: string;
  user_id: string;
  username?: string;
  display_name?: string;
  device_tag?: string;
  password?: string;
  credentials?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    created_at: number;
  };
  cache?: {
    pi?: CachedData;
    user?: CachedData;
    kyc?: CachedData;
    mainnet?: CachedData;
  };
  added_at?: number;
}

// Database initialization
const dbName = "pi-accounts-db";
const storeName = "accounts";
const DB_VERSION = 2; // Increment version number

let dbPromise: Promise<unknown>;

if (typeof window !== "undefined") {
  dbPromise = openDB(dbName, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(
        `Upgrading database from version ${oldVersion} to ${newVersion}`
      );

      // Create accounts store if it doesn't exist
      if (!db.objectStoreNames.contains(storeName)) {
        console.log("Creating accounts store");
        db.createObjectStore(storeName, { keyPath: "phone_number" });
      }

      // Handle migration from potential old schema
      if (oldVersion < 2) {
        // Try to recover data from old DB if it exists
        try {
          console.log("Attempting to migrate data from old database");
          const oldDBPromise = openDB("pi-accounts", 1, {
            upgrade() {
              // No upgrades needed, just opening to check if it exists
            },
          });

          // We'll migrate data after opening both databases
          oldDBPromise
            .then(async (oldDB) => {
              try {
                // Check if old DB has the store
                if (oldDB.objectStoreNames.contains("accounts")) {
                  console.log("Found old database with accounts store");

                  // Get all accounts from old DB
                  const oldAccounts = await oldDB.getAll("accounts");
                  console.log(
                    `Found ${oldAccounts.length} accounts in old database`
                  );

                  // Put them in new DB
                  const store = transaction.objectStore(storeName);
                  for (const account of oldAccounts) {
                    await store.put(account);
                  }

                  console.log("Migration complete");
                }
              } catch (error) {
                console.error("Error during migration:", error);
              } finally {
                oldDB.close();
              }
            })
            .catch(() => {
              console.log("Old database not found, no migration needed");
            });
        } catch (error) {
          console.error("Error opening old database:", error);
        }
      }
    },
  });
}

// Cache configuration
const CACHE_CONFIG = {
  pi: {
    lifetime: 30 * 60 * 1000, // 30 minutes for Pi balance
    refreshInterval: 15 * 60 * 1000, // Refresh every 15 minutes
  },
  user: {
    lifetime: 24 * 60 * 60 * 1000, // 24 hours for user data
    refreshInterval: 12 * 60 * 60 * 1000, // Refresh every 12 hours
  },
  kyc: {
    lifetime: 24 * 60 * 60 * 1000, // 24 hours for KYC status
    refreshInterval: 12 * 60 * 60 * 1000, // Refresh every 12 hours
  },
  mainnet: {
    lifetime: 30 * 60 * 1000, // 30 minutes for mainnet balance
    refreshInterval: 15 * 60 * 1000, // Refresh every 15 minutes
  },
};

// Add these interfaces
export interface CachedData {
  data: unknown;
  timestamp: number;
  lastRefreshAttempt?: number;
  isStale?: boolean;
}

export interface AccountCache {
  pi?: CachedData;
  user?: CachedData;
  kyc?: CachedData;
  mainnet?: CachedData;
}

// Add cache functions
export async function setCacheData(
  phoneNumber: string,
  type: "pi" | "user" | "kyc" | "mainnet",
  data: unknown
) {
  if (!dbPromise) {
    console.error("Database not initialized");
    throw new Error("Database not initialized");
  }

  const db = (await dbPromise) as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);

  if (!account) {
    console.error(`Account ${phoneNumber} not found in IndexedDB`);
    throw new Error(`Account ${phoneNumber} not found.`);
  }

  if (!account.cache) {
    account.cache = {};
  }

  account.cache[type] = {
    data,
    timestamp: Date.now(),
    isStale: false,
  };

  await db.put(storeName, account);

  // If Supabase sync is enabled, update cache in Supabase as well
  if (CONFIG.ENABLE_SUPABASE_SYNC) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData && sessionData.session) {
        try {
          await setCacheDataSupabase(
            phoneNumber,
            type,
            JSON.parse(JSON.stringify(data))
          );
        } catch (syncError) {
          console.error(
            `Error syncing ${type} cache with Supabase:`,
            syncError
          );
          // Continue anyway - data is already saved to IndexedDB
        }
      } else {
        console.log("No active Supabase session, skipping cache sync");
      }
    } catch (sessionError) {
      console.error("Error getting Supabase session:", sessionError);
      // Continue anyway - data is already saved to IndexedDB
    }
  }

  return account;
}

export async function getCacheData(
  phoneNumber: string,
  type: "pi" | "user" | "kyc" | "mainnet"
): Promise<unknown> {
  if (!dbPromise) {
    console.error("Database not initialized");
    return null;
  }

  const db = (await dbPromise) as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account?.cache?.[type]) return null;

  const cache = account.cache[type];
  const now = Date.now();
  const age = now - cache.timestamp;
  const timeSinceLastRefresh = now - (cache.lastRefreshAttempt || 0);

  // Check if it's time to refresh the cache
  if (timeSinceLastRefresh >= CACHE_CONFIG[type].refreshInterval) {
    // Mark the cache as stale but still return the data
    if (!cache.isStale) {
      cache.isStale = true;
      await db.put(storeName, account);
    }
  }

  // Return cached data if within lifetime, even if marked as stale
  if (age < CACHE_CONFIG[type].lifetime) {
    return cache.data;
  }

  // If beyond lifetime but we have data, mark as stale but still return it
  if (cache.data) {
    if (!cache.isStale) {
      cache.isStale = true;
      await db.put(storeName, account);
    }
    return cache.data;
  }

  return null;
}

export async function clearCache(phoneNumber: string) {
  if (!dbPromise) {
    console.error("Database not initialized");
    return null;
  }

  const db = (await dbPromise) as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account) return;

  account.cache = {};
  return db.put(storeName, account);
}

export async function refreshCache(
  phoneNumber: string,
  type: "pi" | "user" | "kyc" | "mainnet"
): Promise<void> {
  if (!dbPromise) {
    console.error("Database not initialized");
    return;
  }

  const db = (await dbPromise) as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account?.cache?.[type]) return;

  const cache = account.cache[type];
  cache.lastRefreshAttempt = Date.now();
  cache.isStale = false;

  await db.put(storeName, account);
}

export async function getAccount(
  phoneNumber: string
): Promise<StoredAccount | undefined> {
  if (!dbPromise) {
    console.error("Database not initialized");
    return undefined;
  }
  const db = (await dbPromise) as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  return account;
}

// Remove the first saveAccount implementation and keep only this one
export async function saveAccount(accountData: {
  phone_number: string;
  user_id: string;
  username?: string;
  display_name?: string;
  device_tag?: string;
  credentials?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    created_at: number;
  };
  cache?: {
    pi?: CachedData;
    user?: CachedData;
    kyc?: CachedData;
    mainnet?: CachedData;
  };
}) {
  if (!dbPromise) {
    console.error("Database not initialized");
    return null;
  }

  // Check if account already exists to preserve existing data
  const existingAccount = await getAccount(accountData.phone_number);

  const account: StoredAccount = {
    phone_number: accountData.phone_number,
    user_id: accountData.user_id,
    username: accountData.username,
    display_name: accountData.display_name,
    device_tag: accountData.device_tag,
    credentials: accountData.credentials || existingAccount?.credentials,
    cache: accountData.cache || existingAccount?.cache || {},
  };

  // Remove duplicate db declaration since it's declared again below
  const db = await dbPromise;
  await (db as IDBPDatabase).put(storeName, account);

  // If Supabase sync is enabled, save to Supabase as well
  if (CONFIG.ENABLE_SUPABASE_SYNC) {
    try {
      // Get the current session
      const { data } = await supabase.auth.getSession();

      if (data && data.session) {
        try {
          // Save account data
          await saveAccountSupabase({
            phone_number: accountData.phone_number,
            username: accountData.username,
            display_name: accountData.display_name,
            device_tag: accountData.device_tag,
            access_token: accountData.credentials?.access_token,
            token_type: accountData.credentials?.token_type,
            expires_in: accountData.credentials?.expires_in,
            token_created_at: accountData.credentials?.created_at,
          });

          // Save cache data
          if (accountData.cache) {
            for (const type of ["pi", "user", "kyc", "mainnet"] as const) {
              if (accountData.cache[type]) {
                try {
                  await setCacheDataSupabase(
                    accountData.phone_number,
                    type,
                    JSON.parse(JSON.stringify(accountData.cache[type]?.data))
                  );
                } catch (cacheError) {
                  console.error(
                    `Error syncing ${type} cache with Supabase:`,
                    cacheError
                  );
                  // Continue with other cache types
                }
              }
            }
          }
        } catch (syncError) {
          console.error("Error syncing account with Supabase:", syncError);
          // Continue anyway - data is already saved to IndexedDB
        }
      }
    } catch (sessionError) {
      console.error("Error getting Supabase session:", sessionError);
      // Continue anyway - data is already saved to IndexedDB
    }
  }
}

export async function getAllAccounts(): Promise<StoredAccount[]> {
  if (!dbPromise) return [];
  const db = (await dbPromise) as IDBPDatabase;
  const localAccounts = await db.getAll(storeName);

  // If local database is empty, try to fetch from Supabase
  if (localAccounts.length === 0) {
    try {
      // Import dynamically to avoid circular dependencies
      const { getAllAccountsSupabase } = await import("./supabase");
      console.log(
        "Local database is empty, fetching accounts from Supabase..."
      );

      const supabaseAccounts = await getAllAccountsSupabase();

      if (supabaseAccounts && supabaseAccounts.length > 0) {
        console.log(
          `Found ${supabaseAccounts.length} accounts in Supabase, syncing to local database...`
        );

        // Convert Supabase accounts to local format and save to IndexedDB
        for (const account of supabaseAccounts) {
          const localAccount: StoredAccount = {
            phone_number: account.phone_number,
            user_id: account.user_id,
            username: account.username || undefined,
            display_name: account.display_name || undefined,
            device_tag: account.device_tag || undefined,
            password: account.password || undefined,
            credentials: account.access_token
              ? {
                  access_token: account.access_token,
                  token_type: account.token_type || "Bearer",
                  expires_in: account.expires_in || 0,
                  created_at: account.token_created_at || Date.now(),
                }
              : undefined,
          };

          // Save to local database
          await db.put(storeName, localAccount);
        }

        // Get the updated accounts from local database
        return db.getAll(storeName);
      }

      console.log("No accounts found in Supabase");
      return [];
    } catch (error) {
      console.error("Error fetching accounts from Supabase:", error);
      return [];
    }
  }

  return localAccounts;
}

export async function removeAccount(phoneNumber: string) {
  if (!dbPromise) return null;
  const db = (await dbPromise) as IDBPDatabase;
  return db.delete(storeName, phoneNumber);
}

export async function validateAccount(phoneNumber: string): Promise<boolean> {
  const account = await getAccount(phoneNumber);
  if (!account) {
    console.error("Account not found");
    return false;
  }

  const isValid =
    account.phone_number &&
    account.user_id &&
    account.credentials?.access_token;

  return Boolean(isValid);
}

export async function insertAccount(phoneNumber: string, password: string) {
  if (!dbPromise) {
    console.error("Database not initialized");
    return null;
  }

  // Create a basic account with phone_number and password
  const account: StoredAccount = {
    phone_number: phoneNumber,
    user_id: `temp_${Date.now()}`, // Temporary user ID until authenticated
    password: password, // Store the password
    added_at: Date.now(), // Add timestamp
    cache: {},
  };

  const db = (await dbPromise) as IDBPDatabase;
  return db.put(storeName, account);
}

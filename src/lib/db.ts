'use client';

import { IDBPDatabase, openDB } from 'idb';

export interface StoredAccount {
  phone_number: string;
  user_id: string;
  username?: string;
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
}

const dbName = 'pi-accounts-db';
const storeName = 'accounts';

let dbPromise: Promise<unknown>;

if (typeof window !== 'undefined') {
  dbPromise = openDB(dbName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'phone_number' });
      }
    },
  });
}
// Cache configuration
const CACHE_CONFIG = {
  pi: {
    lifetime: 30 * 60 * 1000, // 30 minutes for Pi balance
    refreshInterval: 15 * 60 * 1000 // Refresh every 15 minutes
  },
  user: {
    lifetime: 24 * 60 * 60 * 1000, // 24 hours for user data
    refreshInterval: 12 * 60 * 60 * 1000 // Refresh every 12 hours
  },
  kyc: {
    lifetime: 24 * 60 * 60 * 1000, // 24 hours for KYC status
    refreshInterval: 12 * 60 * 60 * 1000 // Refresh every 12 hours
  },
  mainnet: {
    lifetime: 30 * 60 * 1000, // 30 minutes for mainnet balance
    refreshInterval: 15 * 60 * 1000 // Refresh every 15 minutes
  }
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
export async function setCacheData(phoneNumber: string, type: 'pi' | 'user' | 'kyc'| 'mainnet', data: unknown) {
  const db = await dbPromise as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account) return;

  account.cache = account.cache || {};
  account.cache[type] = {
    data,
    timestamp: Date.now(),
    lastRefreshAttempt: Date.now(),
    isStale: false
  };

  return db.put(storeName, account);
}

export async function getCacheData(phoneNumber: string, type: 'pi' | 'user' | 'kyc'| 'mainnet'): Promise<unknown> {
  const db = await dbPromise as IDBPDatabase;
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
  const db = await dbPromise as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account) return;

  account.cache = {};
  return db.put(storeName, account);
}

export async function refreshCache(phoneNumber: string, type: 'pi' | 'user' | 'kyc'| 'mainnet'): Promise<void> {
  const db = await dbPromise as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account?.cache?.[type]) return;

  const cache = account.cache[type];
  cache.lastRefreshAttempt = Date.now();
  cache.isStale = false;
  
  await db.put(storeName, account);
}
export async function getAccount(phoneNumber: string): Promise<StoredAccount | undefined> {
  if (!dbPromise) {
    console.error('Database not initialized');
    return undefined;
  }
  const db = await dbPromise as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  return account;
}
// Remove the first saveAccount implementation and keep only this one
export async function saveAccount(accountData: { 
  phone_number: string;
  user_id: string;
  username?: string;
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
    console.error('Database not initialized');
    return null;
  }
  
  // Check if account already exists to preserve existing data
  const existingAccount = await getAccount(accountData.phone_number);
  
  const account: StoredAccount = {
    phone_number: accountData.phone_number,
    user_id: accountData.user_id,
    username: accountData.username,
    device_tag: accountData.device_tag,
    credentials: accountData.credentials || existingAccount?.credentials,
    cache: accountData.cache || existingAccount?.cache || {}
  };
  
  // Remove duplicate db declaration since it's declared again below
  const db = await dbPromise;
  return await (db as IDBPDatabase).put(storeName, account);
}
export async function getAllAccounts(): Promise<StoredAccount[]> {
  if (!dbPromise) return [];
  const db = await dbPromise as IDBPDatabase;
  return db.getAll(storeName);
}
export async function removeAccount(phoneNumber: string) {
  if (!dbPromise) return null;
  const db = await dbPromise as IDBPDatabase;
  return db.delete(storeName, phoneNumber);
}
export async function validateAccount(phoneNumber: string): Promise<boolean> {
  const account = await getAccount(phoneNumber);
  if (!account) {
    console.error('Account not found');
    return false;
  }
  
  const isValid = 
    account.phone_number && 
    account.user_id && 
    account.credentials?.access_token;
  
  return Boolean(isValid);
}
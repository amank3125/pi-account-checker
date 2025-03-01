'use client';

import { IDBPDatabase, openDB } from 'idb';

export interface StoredAccount {
  phone_number: string;
  user_id: string;
  credentials?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    created_at: number;
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
// Add these interfaces
export interface CachedData {
  data: unknown;
  timestamp: number;
}

export interface AccountCache {
  pi?: CachedData;
  user?: CachedData;
  kyc?: CachedData;
}

// Add cache functions
export async function setCacheData(phoneNumber: string, type: 'pi' | 'user' | 'kyc', data: unknown) {
  const db = await dbPromise as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account) return;

  account.cache = account.cache || {};
  account.cache[type] = {
    data,
    timestamp: Date.now()
  };

  return db.put(storeName, account);
}

export async function getCacheData(phoneNumber: string, type: 'pi' | 'user' | 'kyc'): Promise<unknown> {
  const db = await dbPromise as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account?.cache?.[type]) return null;

  const cache = account.cache[type];
  const isCacheValid = Date.now() - cache.timestamp < 15 * 60 * 1000; // 15 minutes
  
  return isCacheValid ? cache.data : null;
}

export async function clearCache(phoneNumber: string) {
  const db = await dbPromise as IDBPDatabase;
  const account = await db.get(storeName, phoneNumber);
  if (!account) return;

  account.cache = {};
  return db.put(storeName, account);
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

export async function saveAccount(accountData: { 
  phone_number: string;
  user_id: string;
  credentials: {
    access_token: string;
    token_type: string;
    expires_in: number;
    created_at: number;
  };
}) {
  if (!dbPromise) {
    console.error('Database not initialized');
    return null;
  }
  
  // Create account object with correct structure
  const account = {
    phone_number: accountData.phone_number,
    user_id: accountData.user_id,
    access_token: accountData.credentials.access_token,
    credentials: accountData.credentials
  };
  const db = await dbPromise;
  const result = await (db as IDBPDatabase).put(storeName, account);
  
  // Verify saved data
return result;
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
    account.credentials.access_token;  
  return Boolean(isValid);
}
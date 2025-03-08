import { supabase } from "./supabase";
import { getAllAccounts } from "./db";

// Interface for mining data
interface MiningData {
  id?: string;
  phone_number: string;
  balance?: number;
  last_mined_at?: string | null;
  mining_status?: { is_mining: boolean } | null;
  updated_at: string; // ISO timestamp for comparison
  // Add other fields as needed
}

// Store for tracking sync status
interface SyncStatus {
  lastSync: number;
  inProgress: boolean;
}

const syncStatus: SyncStatus = {
  lastSync: 0,
  inProgress: false,
};

/**
 * Get mining data from local IndexedDB
 */
export async function getLocalMiningData(): Promise<MiningData[]> {
  try {
    // Get accounts from IndexedDB
    const accounts = await getAllAccounts();

    // Get mining data for each account from localStorage
    const miningData: MiningData[] = [];

    for (const account of accounts) {
      const storedData = localStorage.getItem(
        `mining_data_${account.phone_number}`
      );

      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          miningData.push({
            ...parsed,
            phone_number: account.phone_number,
            // Ensure we have an updated_at field for comparison
            updated_at: parsed.updated_at || new Date().toISOString(),
          });
        } catch (e) {
          console.error(
            `Error parsing mining data for ${account.phone_number}:`,
            e
          );
        }
      } else {
        // If we don't have stored mining data, create a placeholder
        miningData.push({
          phone_number: account.phone_number,
          updated_at: new Date(0).toISOString(), // Very old date to ensure it gets updated
        });
      }
    }

    return miningData;
  } catch (error) {
    console.error("Error getting local mining data:", error);
    return [];
  }
}

/**
 * Get mining data from Supabase
 */
export async function getSupabaseMiningData(
  phoneNumbers: string[]
): Promise<MiningData[]> {
  try {
    if (!phoneNumbers.length) return [];

    const { data, error } = await supabase
      .from("mining_data")
      .select("*")
      .in("phone_number", phoneNumbers);

    if (error) {
      console.error("Error fetching mining data from Supabase:", error);
      return [];
    }

    // Ensure all records have an updated_at field
    return (data || []).map((item) => ({
      ...item,
      updated_at: item.updated_at || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error in getSupabaseMiningData:", error);
    return [];
  }
}

/**
 * Compare and determine which records need updates in either direction
 */
function compareData(
  localData: MiningData[],
  remoteData: MiningData[]
): {
  toUpdateLocal: MiningData[];
  toUpdateRemote: MiningData[];
} {
  const remoteMap = new Map<string, MiningData>();
  remoteData.forEach((item) => remoteMap.set(item.phone_number, item));

  const localMap = new Map<string, MiningData>();
  localData.forEach((item) => localMap.set(item.phone_number, item));

  const toUpdateLocal: MiningData[] = [];
  const toUpdateRemote: MiningData[] = [];

  // Check local items against remote
  localData.forEach((localItem) => {
    const remoteItem = remoteMap.get(localItem.phone_number);

    if (!remoteItem) {
      // Item doesn't exist in remote, add to remote updates
      toUpdateRemote.push(localItem);
    } else {
      // Both exist, compare dates
      const localDate = new Date(localItem.updated_at);
      const remoteDate = new Date(remoteItem.updated_at);

      if (localDate > remoteDate) {
        // Local is newer, update remote
        toUpdateRemote.push(localItem);
      } else if (remoteDate > localDate) {
        // Remote is newer, update local
        toUpdateLocal.push(remoteItem);
      }
      // If dates are equal, no update needed
    }
  });

  // Check for remote items not in local
  remoteData.forEach((remoteItem) => {
    if (!localMap.has(remoteItem.phone_number)) {
      toUpdateLocal.push(remoteItem);
    }
  });

  return { toUpdateLocal, toUpdateRemote };
}

/**
 * Update local mining data
 */
export async function updateLocalMiningData(
  items: MiningData[]
): Promise<void> {
  for (const item of items) {
    try {
      localStorage.setItem(
        `mining_data_${item.phone_number}`,
        JSON.stringify(item)
      );
    } catch (e) {
      console.error(`Error saving mining data for ${item.phone_number}:`, e);
    }
  }
}

/**
 * Update Supabase mining data
 */
export async function updateSupabaseMiningData(
  items: MiningData[]
): Promise<void> {
  if (!items.length) return;

  try {
    // Process in batches to avoid large requests
    const BATCH_SIZE = 10;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      // Prepare data for upsert
      const dataToUpsert = batch.map((item) => ({
        ...item,
        // Ensure the updated_at field is current
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("mining_data")
        .upsert(dataToUpsert, {
          onConflict: "phone_number",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Error updating mining data in Supabase:", error);
      }

      // Small delay between batches
      if (i + BATCH_SIZE < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  } catch (error) {
    console.error("Error in updateSupabaseMiningData:", error);
  }
}

/**
 * Main sync function - syncs mining data bidirectionally
 */
export async function syncMiningData(force = false): Promise<boolean> {
  // Prevent multiple syncs running at once
  if (syncStatus.inProgress) {
    console.log("[SYNC] Mining data sync already in progress, skipping");
    return false;
  }

  // Check if we've synced recently (within last hour)
  const now = Date.now();
  const HOUR_IN_MS = 60 * 60 * 1000;

  if (!force && now - syncStatus.lastSync < HOUR_IN_MS) {
    console.log("[SYNC] Mining data was synced less than 1 hour ago, skipping");
    return false;
  }

  syncStatus.inProgress = true;

  try {
    console.log("[SYNC] Starting bidirectional mining data sync");

    // Get local accounts
    const accounts = await getAllAccounts();
    const phoneNumbers = accounts.map((a) => a.phone_number);

    if (!phoneNumbers.length) {
      console.log("[SYNC] No accounts found, skipping sync");
      return false;
    }

    // Get data from both sources
    const localData = await getLocalMiningData();
    console.log(`[SYNC] Retrieved ${localData.length} local mining records`);

    const remoteData = await getSupabaseMiningData(phoneNumbers);
    console.log(`[SYNC] Retrieved ${remoteData.length} remote mining records`);

    // Compare and determine what needs updates
    const { toUpdateLocal, toUpdateRemote } = compareData(
      localData,
      remoteData
    );

    console.log(
      `[SYNC] Sync results: ${toUpdateLocal.length} local and ${toUpdateRemote.length} remote updates needed`
    );

    // Perform updates
    if (toUpdateLocal.length > 0) {
      console.log(`[SYNC] Updating ${toUpdateLocal.length} local records`);
      await updateLocalMiningData(toUpdateLocal);
    }

    if (toUpdateRemote.length > 0) {
      console.log(`[SYNC] Updating ${toUpdateRemote.length} remote records`);
      await updateSupabaseMiningData(toUpdateRemote);
    }

    // Update sync status
    syncStatus.lastSync = now;
    localStorage.setItem("lastMiningDataSync", now.toString());

    console.log("[SYNC] Mining data sync completed successfully");
    return toUpdateLocal.length > 0 || toUpdateRemote.length > 0;
  } catch (error) {
    console.error("[SYNC] Error during mining data sync:", error);
    return false;
  } finally {
    syncStatus.inProgress = false;
    console.log("[SYNC] Sync process completed");
  }
}

/**
 * Helper function to get the latest mining data (synced from either source)
 */
export async function getLatestMiningData(): Promise<MiningData[]> {
  // Trigger a sync first
  await syncMiningData();

  // Then get local data, which should now be the most up-to-date
  return getLocalMiningData();
}

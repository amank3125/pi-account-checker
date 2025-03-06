"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "../types/supabase";
import { Json } from "../types/supabase";
import { StoredAccount } from "./db";
import { createClient } from "@supabase/supabase-js";

// Regular client with user permissions
export const supabase = createClientComponentClient<Database>();

// Service role client for admin operations
// This will be used only during migration to bypass RLS policies
let adminClient: ReturnType<typeof createClient> | null = null;

// Initialize the admin client with service role key
export function getAdminClient() {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Check if we have a temporary service role key stored in localStorage
    let serviceRoleKey: string | undefined | null = undefined;

    try {
      if (typeof window !== "undefined") {
        // We're in a browser context
        serviceRoleKey = window.localStorage.getItem(
          "TEMP_SUPABASE_SERVICE_ROLE_KEY"
        );
        console.log(
          "Found temporary service key in localStorage:",
          !!serviceRoleKey
        );
      }

      // Fall back to environment variable if no temp key found
      if (!serviceRoleKey) {
        serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
        console.log(
          "Using environment variable service key:",
          !!serviceRoleKey
        );
      }

      if (!supabaseUrl) {
        throw new Error(
          "Missing Supabase URL. Please check your environment variables."
        );
      }

      if (!serviceRoleKey) {
        throw new Error(
          "Missing Service Role Key. Please provide it in the migration form."
        );
      }

      adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      console.log("Admin client created successfully");
    } catch (error) {
      console.error("Error creating admin client:", error);
      throw new Error(
        `Supabase admin client error: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  return adminClient;
}

// Track the last OTP request time to prevent rate limiting
let lastOtpRequestTime = 0;
const OTP_COOLDOWN_PERIOD = 60000; // 60 seconds cooldown between OTP requests

// Ensure the NextAuth user exists in Supabase and sign in
export async function ensureUserExists(
  email: string,
  name?: string | null,
  image?: string | null
): Promise<boolean> {
  try {
    // Check if we already have an active session
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session) {
      console.log(
        "Active Supabase session exists:",
        sessionData.session.user.email
      );
      return true;
    }

    // Check if we're within the rate limit cooldown period
    const now = Date.now();
    const timeElapsed = now - lastOtpRequestTime;

    if (timeElapsed < OTP_COOLDOWN_PERIOD) {
      const secondsRemaining = Math.ceil(
        (OTP_COOLDOWN_PERIOD - timeElapsed) / 1000
      );
      console.log(
        `Rate limit cooldown active. Please try again in ${secondsRemaining} seconds.`
      );
      throw new Error(
        `Rate limit protection: Please wait ${secondsRemaining} seconds before requesting another login link`
      );
    }

    // No session, try signing in with magic link
    console.log("No active session, signing in with Supabase");

    // Update the last request time before making the API call
    lastOtpRequestTime = now;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          name: name || "",
          avatar_url: image || "",
          source: "nextauth-google",
        },
      },
    });

    if (signInError) {
      console.error("Error signing in with Supabase:", signInError);
      return false;
    }

    console.log("Sent magic link to:", email);

    // Return true for now, magic link will create session when clicked
    return true;
  } catch (error) {
    console.error("Exception during Supabase auth:", error);
    throw error; // Re-throw to allow component to handle the rate limit message
  }
}

export interface StoredAccountSupabase {
  id: string;
  user_id: string;
  phone_number: string;
  username?: string | null;
  display_name?: string | null;
  device_tag?: string | null;
  password?: string | null;
  access_token?: string | null;
  token_type?: string | null;
  expires_in?: number | null;
  token_created_at?: number | null;
  added_at?: string;
}

export interface AccountCacheSupabase {
  id: string;
  account_id: string;
  cache_type: "pi" | "user" | "kyc" | "mainnet";
  data: Json;
  timestamp: number;
  last_refresh_attempt?: number | null;
  is_stale?: boolean | null;
}

// Get all accounts for the current user
export async function getAllAccountsSupabase(): Promise<
  StoredAccountSupabase[]
> {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    console.error("Error: Not authenticated with Supabase");
    return [];
  }

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", authData.user.id);

  if (error) {
    console.error("Error fetching accounts from Supabase:", error);
    throw error;
  }

  console.log(
    `Found ${accounts?.length || 0} accounts in Supabase for user ${
      authData.user.id
    }`
  );
  return accounts || [];
}

// Get a specific account by phone number
export async function getAccountSupabase(
  phoneNumber: string
): Promise<StoredAccountSupabase | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("phone_number", phoneNumber)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is the "row not found" error
    console.error("Error fetching account:", error);
    throw error;
  }

  return data;
}

// Save an account (insert or update)
export async function saveAccountSupabase(accountData: {
  phone_number: string;
  user_id?: string;
  username?: string;
  display_name?: string;
  device_tag?: string;
  password?: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  token_created_at?: number;
}): Promise<string> {
  // First check authentication
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    throw new Error("You must be logged in to save account data");
  }

  // Use the authenticated user ID if no specific user_id provided
  const userId = accountData.user_id || authData.user.id;

  try {
    // First check if this phone number already exists in the database
    const { data: existingAccount, error: fetchError } = await supabase
      .from("accounts")
      .select("id, user_id, access_token, token_created_at")
      .eq("phone_number", accountData.phone_number)
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking for existing account:", fetchError);
      throw new Error(
        `Failed to check for existing account: ${fetchError.message}`
      );
    }

    let accountId: string;

    if (existingAccount) {
      // Phone number already exists, determine whether to update based on token freshness
      console.log(
        `Phone number ${accountData.phone_number} already exists - checking data freshness`
      );

      accountId = existingAccount.id;

      // Determine if we should update the data based on token freshness
      let shouldUpdate = true;

      // If both have tokens, use the newer one
      if (existingAccount.token_created_at && accountData.token_created_at) {
        // Only update if the new token is fresher
        shouldUpdate =
          accountData.token_created_at > existingAccount.token_created_at;
        console.log(
          `Token comparison: existing=${existingAccount.token_created_at}, new=${accountData.token_created_at}, shouldUpdate=${shouldUpdate}`
        );
      }

      if (shouldUpdate) {
        console.log(`Updating account data for ${accountData.phone_number}`);

        // Prepare the update object, only include fields that are provided
        const updateData: Record<string, unknown> = {};

        if (accountData.username !== undefined)
          updateData.username = accountData.username;
        if (accountData.display_name !== undefined)
          updateData.display_name = accountData.display_name;
        if (accountData.device_tag !== undefined)
          updateData.device_tag = accountData.device_tag;
        if (accountData.password !== undefined)
          updateData.password = accountData.password;
        if (accountData.access_token !== undefined)
          updateData.access_token = accountData.access_token;
        if (accountData.token_type !== undefined)
          updateData.token_type = accountData.token_type;
        if (accountData.expires_in !== undefined)
          updateData.expires_in = accountData.expires_in;
        if (accountData.token_created_at !== undefined)
          updateData.token_created_at = accountData.token_created_at;

        // Only perform update if there's something to update
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from("accounts")
            .update(updateData)
            .eq("id", accountId);

          if (updateError) {
            console.error("Error updating account data:", updateError);
            throw new Error(
              `Failed to update account data: ${updateError.message}`
            );
          }
        }
      } else {
        console.log(
          `Keeping existing data for ${accountData.phone_number} as it's more recent`
        );
      }
    } else {
      // Phone number doesn't exist yet, insert a new record
      console.log(
        `Phone number ${accountData.phone_number} doesn't exist - inserting new record`
      );

      // Use upsert instead of insert to handle potential race conditions
      const { data: newAccount, error: insertError } = await supabase
        .from("accounts")
        .upsert(
          {
            user_id: userId,
            phone_number: accountData.phone_number,
            username: accountData.username,
            display_name: accountData.display_name,
            device_tag: accountData.device_tag,
            password: accountData.password,
            access_token: accountData.access_token,
            token_type: accountData.token_type,
            expires_in: accountData.expires_in,
            token_created_at: accountData.token_created_at,
          },
          {
            onConflict: "phone_number", // Handle conflict on phone_number
            ignoreDuplicates: false, // Update existing record if phone_number exists
          }
        )
        .select("id")
        .single();

      if (insertError) {
        console.error("Error inserting new account:", insertError);
        throw new Error(`Failed to insert new account: ${insertError.message}`);
      }

      if (!newAccount) {
        throw new Error("Failed to insert new account: No data returned");
      }

      accountId = newAccount.id;
    }

    return accountId;
  } catch (error) {
    console.error("Error in saveAccountSupabase:", error);
    throw new Error(
      `Error in saveAccountSupabase: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`
    );
  }
}

// Insert a new account with basic info
export async function insertAccountSupabase(
  phoneNumber: string,
  password: string
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      phone_number: phoneNumber,
      password: password,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error inserting account:", error);
    throw error;
  }

  return data.id;
}

// Remove an account
export async function removeAccountSupabase(
  phoneNumber: string
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("phone_number", phoneNumber);

  if (error) {
    console.error("Error removing account:", error);
    throw error;
  }
}

// Get cache data for an account
export async function getCacheDataSupabase(
  phoneNumber: string,
  type: "pi" | "user" | "kyc" | "mainnet"
): Promise<Json | null> {
  // First get the account ID
  const account = await getAccountSupabase(phoneNumber);
  if (!account) return null;

  const { data, error } = await supabase
    .from("account_cache")
    .select("data")
    .eq("account_id", account.id)
    .eq("cache_type", type)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(`Error fetching ${type} cache:`, error);
    throw error;
  }

  return data?.data || null;
}

// Set cache data for an account
export async function setCacheDataSupabase(
  phoneNumber: string,
  type: "pi" | "user" | "kyc" | "mainnet",
  data: Json
): Promise<void> {
  // First get the account ID
  let account = await getAccountSupabase(phoneNumber);

  // If account doesn't exist, create it
  if (!account) {
    try {
      // Get the current authenticated user
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        throw new Error("You must be logged in to save cache data");
      }

      // Create a basic account entry
      await saveAccountSupabase({
        phone_number: phoneNumber,
        user_id: authData.user.id,
        display_name: `Account ${phoneNumber.slice(-4)}`,
      });

      // Fetch the newly created account
      account = await getAccountSupabase(phoneNumber);

      if (!account) {
        throw new Error("Failed to create account in Supabase");
      }

      console.log(`Created new account in Supabase for ${phoneNumber}`);
    } catch (error) {
      console.error("Error creating account in Supabase:", error);
      throw new Error(
        `Failed to create account: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  const timestamp = Date.now();

  // Check if cache entry exists
  const { data: existingCache, error: fetchError } = await supabase
    .from("account_cache")
    .select("id")
    .eq("account_id", account.id)
    .eq("cache_type", type)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    console.error(`Error checking ${type} cache:`, fetchError);
    throw fetchError;
  }

  if (existingCache) {
    // Update existing cache
    const { error } = await supabase
      .from("account_cache")
      .update({
        data: data,
        timestamp: timestamp,
        is_stale: false,
      })
      .eq("id", existingCache.id);

    if (error) {
      console.error(`Error updating ${type} cache:`, error);
      throw error;
    }
  } else {
    // Insert new cache
    const { error } = await supabase.from("account_cache").insert({
      account_id: account.id,
      cache_type: type,
      data: data,
      timestamp: timestamp,
      is_stale: false,
    });

    if (error) {
      console.error(`Error inserting ${type} cache:`, error);
      throw error;
    }
  }
}

// Mark cache as stale (needs refresh)
export async function refreshCacheSupabase(
  phoneNumber: string,
  type: "pi" | "user" | "kyc" | "mainnet"
): Promise<void> {
  // First get the account ID
  const account = await getAccountSupabase(phoneNumber);
  if (!account) return;

  const { error } = await supabase
    .from("account_cache")
    .update({
      is_stale: true,
      last_refresh_attempt: Date.now(),
    })
    .eq("account_id", account.id)
    .eq("cache_type", type);

  if (error) {
    console.error(`Error marking ${type} cache as stale:`, error);
    throw error;
  }
}

// Clear all cache for an account
export async function clearCacheSupabase(phoneNumber: string): Promise<void> {
  // First get the account ID
  const account = await getAccountSupabase(phoneNumber);
  if (!account) return;

  const { error } = await supabase
    .from("account_cache")
    .delete()
    .eq("account_id", account.id);

  if (error) {
    console.error("Error clearing cache:", error);
    throw error;
  }
}

// Add a function to ensure user session is valid and refreshed

/**
 * Ensures the user has a valid Supabase session and refreshes token if needed
 * @returns true if session is valid, false otherwise
 */
export async function ensureValidSession(): Promise<boolean> {
  try {
    // First check if there's an existing session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      return false;
    }

    if (!sessionData.session) {
      console.error("No active session found");
      return false;
    }

    // Try to refresh the session token
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error("Error refreshing session:", refreshError);
      return false;
    }

    // Test if the session has proper permissions
    const { error: testError } = await supabase
      .from("accounts")
      .select("count")
      .limit(1);

    if (testError) {
      console.error("Permission test failed:", testError);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Session validation error:", error);
    return false;
  }
}

// Update the migrateToSupabase function
export async function migrateToSupabase(
  oldAccounts: StoredAccount[]
): Promise<number> {
  // Check if the user is authenticated and get user data
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Authentication error:", error.message);
    throw new Error(`Authentication failed: ${error.message}`);
  }

  if (!data.session) {
    console.error("No active Supabase session");
    throw new Error("Authentication failed: Auth session missing!");
  }

  const user = data.session.user;
  console.log("Authenticated as:", user.email);

  let migratedCount = 0;

  if (oldAccounts.length === 0) {
    throw new Error("No accounts to migrate");
  }

  console.log(`Starting migration of ${oldAccounts.length} accounts`);

  // First ensure we have a valid session with proper permissions
  const isSessionValid = await ensureValidSession();

  if (!isSessionValid) {
    throw new Error(
      "Your Supabase session is invalid or insufficient permissions. Please sign out and sign back in."
    );
  }

  // Session is valid, proceed with migration using standard client
  console.log("Using standard client for migration");

  try {
    // Process in chunks to avoid overwhelming the database
    const CHUNK_SIZE = 5;
    const chunks = [];

    for (let i = 0; i < oldAccounts.length; i += CHUNK_SIZE) {
      chunks.push(oldAccounts.slice(i, i + CHUNK_SIZE));
    }

    console.log(`Processing ${chunks.length} chunks of accounts`);

    for (const [chunkIndex, chunk] of chunks.entries()) {
      console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length}`);

      for (const account of chunk) {
        try {
          console.log(`Migrating account: ${account.phone_number}`);

          // Step 1: Save account basic information
          const accountId = await saveAccountSupabase({
            user_id: user.id,
            phone_number: account.phone_number,
            username: account.username,
            display_name: account.display_name,
            device_tag: account.device_tag,
            password: account.password,
            access_token: account.credentials?.access_token,
            token_type: account.credentials?.token_type,
            expires_in: account.credentials?.expires_in,
            token_created_at: account.credentials?.created_at,
          });

          console.log(`Account saved with ID: ${accountId}`);

          // Step 2: Migrate cache data if available
          if (account.cache) {
            for (const cacheType of ["pi", "user", "kyc", "mainnet"] as const) {
              if (account.cache[cacheType]) {
                try {
                  // First check if cache already exists to avoid duplicate key errors
                  const { data: existingCache } = await supabase
                    .from("account_cache")
                    .select("id")
                    .eq("account_id", accountId)
                    .eq("cache_type", cacheType)
                    .single();

                  if (existingCache) {
                    // Update existing cache
                    await supabase
                      .from("account_cache")
                      .update({
                        data: account.cache[cacheType].data,
                        timestamp: account.cache[cacheType].timestamp,
                        last_refresh_attempt:
                          account.cache[cacheType].lastRefreshAttempt,
                        is_stale: account.cache[cacheType].isStale,
                      })
                      .eq("id", existingCache.id);

                    console.log(
                      `Updated existing ${cacheType} cache for account ${account.phone_number}`
                    );
                  } else {
                    // Insert new cache
                    await supabase.from("account_cache").insert({
                      account_id: accountId,
                      cache_type: cacheType,
                      data: account.cache[cacheType].data,
                      timestamp: account.cache[cacheType].timestamp,
                      last_refresh_attempt:
                        account.cache[cacheType].lastRefreshAttempt,
                      is_stale: account.cache[cacheType].isStale,
                    });

                    console.log(
                      `Inserted new ${cacheType} cache for account ${account.phone_number}`
                    );
                  }
                } catch (cacheError) {
                  console.error(
                    `Error migrating ${cacheType} cache:`,
                    cacheError
                  );
                }
              }
            }
          }

          migratedCount++;
        } catch (error) {
          console.error(
            `Error migrating account ${account.phone_number}:`,
            error
          );
        }
      }

      // Add a small delay between chunks to avoid rate limiting
      if (chunkIndex < chunks.length - 1) {
        console.log("Pausing briefly between chunks...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return migratedCount;
  } catch (error) {
    console.error("Migration error:", error);
    throw new Error(
      `Migration failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Helper function to authenticate with Supabase using an email/password combination
export async function authenticateWithEmailPassword(
  email: string,
  password: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Failed to sign in with password:", error);
      return false;
    }

    console.log("Successfully signed in with password:", data.user?.email);
    return true;
  } catch (error) {
    console.error("Error during password authentication:", error);
    return false;
  }
}

// Create a Supabase account with email and password
export async function createSupabaseAccount(
  email: string,
  password: string,
  metadata?: { name?: string; avatar_url?: string }
): Promise<boolean> {
  try {
    // First sign up the user with email/password
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: metadata?.name || "",
          avatar_url: metadata?.avatar_url || "",
          source: "create-account-form",
        },
      },
    });

    if (error) {
      console.error("Failed to create Supabase account:", error);
      return false;
    }

    if (data.user) {
      console.log("Supabase account created:", data.user.email);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error creating Supabase account:", error);
    return false;
  }
}

// Add a function to verify Supabase permissions

// Function to verify and fix permissions issues
export async function verifySupabasePermissions(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Check if user is authenticated
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        success: false,
        message: "Not authenticated. Please sign in first.",
      };
    }

    // Try refreshing the session to ensure tokens are up-to-date
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      return {
        success: false,
        message: `Session refresh failed: ${refreshError.message}. Try signing out and back in.`,
      };
    }

    // Try simple query first
    const { error: queryError } = await supabase
      .from("accounts")
      .select("id")
      .limit(1);

    if (queryError) {
      console.log("Query failed:", queryError);

      // This might be because no accounts exist yet, which is okay
      if (queryError.code === "PGRST116") {
        // Row not found
        console.log("No accounts found, this is expected for new users");
      } else {
        return {
          success: false,
          message: `Cannot access the accounts table: ${queryError.message}`,
        };
      }
    }

    // Test insert permissions with test data
    const testPhone = `test-${Date.now()}`;
    const { data: insertData, error: insertError } = await supabase
      .from("accounts")
      .insert({
        user_id: authData.user.id,
        phone_number: testPhone,
        display_name: "Permission Test",
      })
      .select("id")
      .single();

    if (insertError) {
      return {
        success: false,
        message: `Cannot insert data: ${insertError.message}. Your session may need to be refreshed.`,
      };
    }

    // Test update permissions
    if (insertData?.id) {
      const { error: updateError } = await supabase
        .from("accounts")
        .update({ display_name: "Updated Test" })
        .eq("id", insertData.id);

      if (updateError) {
        // Try to clean up the test data anyway
        await supabase.from("accounts").delete().eq("id", insertData.id);

        return {
          success: false,
          message: `Cannot update data: ${updateError.message}`,
        };
      }

      // Test delete permissions
      const { error: deleteError } = await supabase
        .from("accounts")
        .delete()
        .eq("id", insertData.id);

      if (deleteError) {
        return {
          success: false,
          message: `Cannot delete data: ${deleteError.message}`,
        };
      }
    }

    // Everything works!
    return {
      success: true,
      message:
        "Permissions verified successfully. You can migrate your data now.",
    };
  } catch (error) {
    console.error("Error verifying permissions:", error);
    return {
      success: false,
      message: `Error checking permissions: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Direct sign-in with Google account details - no email verification needed
export async function directSignInWithGoogle(
  email: string,
  name?: string | null,
  image?: string | null
): Promise<boolean> {
  try {
    // First check if the user already exists in Supabase by trying to sign in
    // We'll use a random password since we'll immediately reset it
    const tempPassword = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    // Try signing in - this will likely fail if user doesn't exist
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (!signInError) {
      // If this succeeds (unlikely), the user already exists and is now signed in
      console.log("User already exists and is now signed in");
      return true;
    }

    // User doesn't exist or wrong password, let's create a new account
    // We'll use signUp which creates the user but normally requires email verification
    const { data, error } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: {
          name: name || "",
          avatar_url: image || "",
          source: "google-signin-direct",
        },
        // The magic - bypass email verification!
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("Failed to create Supabase account:", error);
      return false;
    }

    // For most Supabase projects, new users need email verification
    // To fully bypass this, you'd need to modify your Supabase project settings
    // or use admin functions with service role, which we're avoiding

    if (data.session) {
      // Success! User is created and signed in without email verification
      console.log("Successfully created and signed in user:", email);
      return true;
    } else {
      // User created but not signed in - likely needs email verification
      console.log("User created but email verification may be required");
      return false;
    }
  } catch (error) {
    console.error("Error creating direct Supabase account:", error);
    return false;
  }
}

// Use Supabase's built-in OAuth with Google to bypass email verification
export async function signInWithGoogleOAuth(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Error initiating Google OAuth:", error);

      // Check for specific error about provider not enabled
      if (
        error.message &&
        (error.message.includes("provider is not enabled") ||
          error.message.includes("Unsupported provider"))
      ) {
        return {
          success: false,
          error:
            "Google authentication is not enabled in Supabase. Please enable it in your Supabase project settings.",
        };
      }

      return { success: false, error: error.message };
    }

    // This won't actually return true because the user is redirected to Google's auth page
    return { success: true };
  } catch (error) {
    console.error("Exception during Google OAuth:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during Google authentication";
    return { success: false, error: errorMessage };
  }
}

// Check if we have an active session and get the user details
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

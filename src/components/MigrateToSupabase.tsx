"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { getAllAccounts } from "@/lib/db";

import {
  ensureValidSession,
  migrateToSupabase,
  signInWithGoogleOAuth,
} from "@/lib/supabase";

import { useSession } from "next-auth/react";

import { supabase } from "@/lib/supabase";

import { IconDatabase, IconDatabaseX, IconLoader } from "@tabler/icons-react";

export default function MigrateToSupabase() {
  const { data: session, status } = useSession();

  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");

  const [migratedCount, setMigratedCount] = useState(0);

  const [isUserSynced, setIsUserSynced] = useState(false);

  const [syncError, setSyncError] = useState<string | null>(null);

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Add session validation tracking ref to prevent loops
  const sessionValidationInProgress = useRef(false);
  const lastSessionCheck = useRef(0);
  const HOUR_IN_MS = 60 * 60 * 1000;

  // Improved autoSyncData function with throttling
  const autoSyncData = useCallback(async () => {
    // EMERGENCY FIX: Exit immediately if validation is in progress or called recently
    if (sessionValidationInProgress.current) {
      console.log("Session validation already in progress, skipping");
      return;
    }

    const now = Date.now();
    if (now - lastSessionCheck.current < HOUR_IN_MS) {
      console.log("Session was checked less than 1 hour ago, skipping");
      return;
    }

    // Track that we're checking
    sessionValidationInProgress.current = true;
    lastSessionCheck.current = now;

    try {
      console.log("Checking for valid Supabase session...");

      // Check localStorage first to avoid unnecessary API calls
      const hasRecentSessionCheck = localStorage.getItem(
        "lastSessionValidation"
      );
      if (
        hasRecentSessionCheck &&
        now - parseInt(hasRecentSessionCheck) < HOUR_IN_MS
      ) {
        const sessionValid = localStorage.getItem("hasValidSession") === "true";
        console.log(
          `Using cached session validation: ${
            sessionValid ? "Valid" : "Invalid"
          }`
        );

        if (!sessionValid) {
          // If we know we don't have a valid session, stop processing
          sessionValidationInProgress.current = false;
          return;
        }
      } else {
        // Only validate session via API if we don't have recent validation
        const isValid = await ensureValidSession();

        // Store result in localStorage to reduce future calls
        localStorage.setItem("lastSessionValidation", now.toString());
        localStorage.setItem("hasValidSession", isValid.toString());

        if (!isValid) {
          console.log("No valid Supabase session found");
          sessionValidationInProgress.current = false;
          return;
        }
      }

      // Get local accounts that need migration
      const oldAccounts = await getAllAccounts();

      if (!oldAccounts || oldAccounts.length === 0) {
        console.log("No accounts found for migration");
        sessionValidationInProgress.current = false;
        return;
      }

      // Check if we've recently migrated
      const lastMigrationTime = localStorage.getItem("lastMigrationTime");
      if (lastMigrationTime && now - parseInt(lastMigrationTime) < HOUR_IN_MS) {
        console.log("Accounts were migrated less than 1 hour ago, skipping");
        sessionValidationInProgress.current = false;
        return;
      }

      // Update UI state
      setSyncStatus("syncing");

      // Migrate accounts with our optimized function
      const migratedCount = await migrateToSupabase(oldAccounts);

      // Update timestamp even if no accounts were migrated
      localStorage.setItem("lastMigrationTime", now.toString());

      if (migratedCount > 0) {
        console.log(`Successfully migrated ${migratedCount} accounts`);
        setSyncStatus("success");
        setMigratedCount(migratedCount);
        setIsUserSynced(true);
      } else {
        console.log("No accounts needed migration at this time");
        setSyncStatus("success");
        setIsUserSynced(true);
      }
    } catch (error) {
      console.error("Error in auto-sync:", error);
      setSyncStatus("error");
    } finally {
      // Always reset the flag when done
      sessionValidationInProgress.current = false;
    }
  }, []);

  // Use effect to check user authentication status once on mount
  useEffect(() => {
    // Only run on first mount and if user is authenticated
    if (status === "authenticated" && session?.user && !isUserSynced) {
      console.log("User is authenticated, checking for sync needs");
      autoSyncData();
    }
  }, [status, session, autoSyncData, isUserSynced]);

  // Check if we already have a locally stored sync timestamp
  useEffect(() => {
    // Try to load last sync time from localStorage
    const storedSyncTime = localStorage.getItem("lastSupabaseSync");
    if (storedSyncTime) {
      try {
        const timestamp = parseInt(storedSyncTime, 10);
        if (!isNaN(timestamp)) {
          setLastSyncTime(new Date(timestamp));
        }
      } catch (e) {
        console.error("Error parsing stored sync time:", e);
      }
    }
  }, []);

  // Auto-sync with Supabase when user is authenticated
  useEffect(() => {
    const syncWithSupabase = async () => {
      if (!session?.user) return;

      // Check if we've synced recently - use a longer cooldown period (15 minutes)
      const SYNC_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
      if (lastSyncTime) {
        const now = new Date();
        const timeSinceLastSync = now.getTime() - lastSyncTime.getTime();

        if (timeSinceLastSync < SYNC_COOLDOWN_MS) {
          console.log(
            `Skipping sync - last sync was ${Math.round(
              timeSinceLastSync / 1000
            )} seconds ago`
          );
          return;
        }
      }

      try {
        // Check if we already have a Supabase session - use cached check when possible
        const sessionKey = "supabaseSessionValid";
        const cachedSession = localStorage.getItem(sessionKey);
        const sessionCacheTime = localStorage.getItem(`${sessionKey}_time`);

        // If we have a cached session status that's less than 30 minutes old, use it
        if (cachedSession === "true" && sessionCacheTime) {
          const cacheAge = Date.now() - parseInt(sessionCacheTime, 10);
          if (cacheAge < 30 * 60 * 1000) {
            // 30 minutes
            console.log("Using cached Supabase session status");
            setIsUserSynced(true);
            setSyncError(null);
            autoSyncData();
            return;
          }
        }

        // No valid cached session, check with Supabase
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          console.log("Active Supabase session found, auto-syncing data");

          // Cache the session status
          localStorage.setItem(sessionKey, "true");
          localStorage.setItem(`${sessionKey}_time`, Date.now().toString());

          setIsUserSynced(true);
          setSyncError(null);
          autoSyncData();
          return;
        }

        // Clear cached session status
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(`${sessionKey}_time`);

        // No Supabase session, trigger automatic Google sign-in
        console.log("No Supabase session found, initiating Google sign-in");
        setIsAuthenticating(true);

        try {
          const result = await signInWithGoogleOAuth();

          if (!result.success && result.error) {
            setSyncError(
              `Failed to auto-connect with Supabase: ${result.error}`
            );
            setSyncStatus("error");
          }
        } catch (error) {
          console.error("Error auto-connecting to Supabase:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setSyncError(`Auto-connection failed: ${errorMessage}`);
          setSyncStatus("error");
        } finally {
          setIsAuthenticating(false);
        }
      } catch (error) {
        console.error("Error during Supabase sync:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setSyncError(errorMessage);
        setSyncStatus("error");
      }
    };

    if (status === "authenticated") {
      syncWithSupabase();
    }
  }, [session, status, lastSyncTime, autoSyncData]);

  // Handle manual sync with throttling
  const handleManualSync = () => {
    const now = Date.now();
    const lastSyncAttempt = localStorage.getItem("lastManualSyncAttempt");

    // Prevent rapid clicking by enforcing a 10-second cooldown
    if (lastSyncAttempt && now - parseInt(lastSyncAttempt) < 10000) {
      console.log("Manual sync was attempted too recently, please wait");
      return;
    }

    localStorage.setItem("lastManualSyncAttempt", now.toString());
    autoSyncData();
  };

  // Render just the database icon

  return (
    <div className="inline-block">
      {/* DB Status Icon */}

      <div
        className="cursor-pointer"
        onClick={handleManualSync}
        title={
          syncError
            ? `Error: ${syncError}. Click to retry.`
            : syncStatus === "success"
            ? `Database in sync. Last synchronized: ${
                lastSyncTime?.toLocaleString() || "Unknown"
              }. ${migratedCount} account(s) synced.`
            : syncStatus === "syncing"
            ? "Syncing data with Supabase..."
            : "Click to sync with Supabase"
        }
      >
        {(syncStatus === "syncing" || isAuthenticating) && (
          <IconLoader
            className="h-8 w-8 ml-1 text-white bg-blue-600 rounded-full p-0.5 border-2 border-blue-400 animate-spin"
            stroke={1.5}
          />
        )}

        {syncStatus === "error" && (
          <IconDatabaseX
            className="h-8 w-8 ml-1 text-white bg-red-600 rounded-full p-0.5 border-2 border-red-400"
            stroke={1.5}
          />
        )}

        {syncStatus === "success" && (
          <IconDatabase
            className="h-8 w-8 ml-1 text-white bg-green-600 rounded-full p-0.5 border-2 border-green-400"
            stroke={1.5}
          />
        )}

        {syncStatus === "idle" && (
          <IconDatabase
            className="h-8 w-8 ml-1 text-white bg-gray-600 rounded-full p-0.5 border-2 border-gray-400"
            stroke={1.5}
          />
        )}
      </div>
    </div>
  );
}

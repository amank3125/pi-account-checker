"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { syncMiningData } from "@/lib/sync";
import { ensureValidSession } from "@/lib/supabase";
import {
  TOAST_IDS,
  showSuccess,
  showError,
  showInfo,
} from "@/lib/notifications";

/**
 * MiningDataSync component - handles automatic bidirectional sync of mining data
 * This can be added to any page that needs mining data sync functionality
 */
export default function MiningDataSync() {
  const { data: session, status } = useSession();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "error" | "up-to-date"
  >("idle");

  // New custom notification system
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
    visible: boolean;
  } | null>(null);

  // Effect to auto-hide notification after a delay
  useEffect(() => {
    if (notification?.visible) {
      const timer = setTimeout(() => {
        setNotification((prev) => (prev ? { ...prev, visible: false } : null));
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Function to show a notification
  const showNotification = (
    type: "success" | "error" | "info",
    message: string
  ) => {
    setNotification({
      type,
      message,
      visible: true,
    });
  };

  // Effect to initialize and run sync when the component mounts
  useEffect(() => {
    const initSync = async () => {
      // Only sync for authenticated users
      if (status !== "authenticated" || !session?.user) {
        return;
      }

      // Check Supabase session
      const hasValidSession = await ensureValidSession();
      if (!hasValidSession) {
        console.log("No valid Supabase session for mining data sync");
        return;
      }

      // Get last sync time from localStorage
      const lastSyncTime = localStorage.getItem("lastMiningDataSync");
      if (lastSyncTime) {
        setLastSync(new Date(parseInt(lastSyncTime)));
      }

      // Run initial sync silently (no toast)
      await performSync(false, false);
    };

    initSync();

    // Set up periodic sync (every 30 minutes) - silently (no toast)
    const syncInterval = setInterval(() => {
      if (status === "authenticated" && session?.user) {
        performSync(false, false);
      }
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(syncInterval);
    };
  }, [status, session]);

  // Function to perform the actual sync
  const performSync = async (force = true, showToast = true) => {
    setSyncStatus("syncing");

    try {
      const success = await syncMiningData(force);

      if (success) {
        // Data was actually synced (changes were made)
        setSyncStatus("success");
        // Update the last sync time
        const now = new Date();
        setLastSync(now);
        localStorage.setItem("lastMiningDataSync", now.getTime().toString());

        // Dispatch a custom event to notify other components that mining data has changed
        window.dispatchEvent(new CustomEvent("mining-data-synced"));

        // Show success notification
        if (showToast) {
          // Try using both notification systems
          showNotification("success", "Mining data synced successfully!");
          showSuccess(
            "Mining data synced successfully!",
            TOAST_IDS.SYNC_SUCCESS,
            3000,
            "🔄"
          );
        }
      } else {
        // No sync was needed, data is already up-to-date
        setSyncStatus("up-to-date");

        // Show info notification
        if (showToast) {
          // Try using both notification systems
          showNotification("info", "Mining data already up-to-date");
          showInfo(
            "Mining data already up-to-date",
            TOAST_IDS.SYNC_UP_TO_DATE,
            3000
          );
        }
      }
    } catch (error) {
      console.error("Error syncing mining data:", error);
      setSyncStatus("error");

      // Show error notification
      if (showToast) {
        // Try using both notification systems
        showNotification("error", "Failed to sync mining data");
        showError("Failed to sync mining data", TOAST_IDS.SYNC_ERROR);
      }
    }
  };

  // Function to handle manual sync
  const handleManualSync = () => {
    // Prevent rapid re-syncs
    if (syncStatus === "syncing") {
      return;
    }

    // For manual sync, always show toast
    performSync(true, true);
  };

  // Determine if we should show the sync button
  const shouldShowSyncButton = () => {
    return (
      syncStatus === "idle" ||
      syncStatus === "success" ||
      syncStatus === "error"
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
      {/* Header bar */}
      <div className="bg-gray-700 px-4 py-2 flex justify-between items-center">
        <h3 className="text-md font-medium text-white">Mining Data Sync</h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-md ${
            syncStatus === "success"
              ? "bg-green-900 text-green-200"
              : syncStatus === "up-to-date"
              ? "bg-blue-900 text-blue-200"
              : syncStatus === "error"
              ? "bg-red-900 text-red-200"
              : syncStatus === "syncing"
              ? "bg-yellow-900 text-yellow-200"
              : "bg-gray-900 text-gray-200"
          }`}
        >
          {syncStatus === "idle"
            ? "Ready"
            : syncStatus === "syncing"
            ? "Syncing..."
            : syncStatus === "success"
            ? "Synced"
            : syncStatus === "up-to-date"
            ? "Up to date"
            : "Error"}
        </span>
      </div>

      {/* Body content */}
      <div className="px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            {lastSync && (
              <div className="text-sm text-gray-300">
                Last synced: {lastSync.toLocaleString()}
              </div>
            )}
          </div>

          <div className="flex">
            {shouldShowSyncButton() && (
              <button
                onClick={handleManualSync}
                disabled={syncStatus === "syncing"}
                className={`ml-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
              </button>
            )}
          </div>
        </div>

        {/* Custom notification system */}
        {notification && notification.visible && (
          <div
            className={`mt-3 p-3 rounded-md text-sm font-medium transition-opacity duration-300 ${
              notification.type === "success"
                ? "bg-green-800 text-green-100"
                : notification.type === "error"
                ? "bg-red-800 text-red-100"
                : "bg-blue-800 text-blue-100"
            }`}
          >
            {notification.type === "success" && "✅ "}
            {notification.type === "error" && "❌ "}
            {notification.type === "info" && "ℹ️ "}
            {notification.message}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { showSuccess, showError, showInfo } from "@/lib/notifications";

interface MiningDataSyncProps {
  onSync: () => Promise<void>;
  hasExpiredSessions: boolean;
  checkForExpiredSessions: () => Promise<number>;
}

const MiningDataSync: React.FC<MiningDataSyncProps> = ({
  onSync,
  hasExpiredSessions,
  checkForExpiredSessions,
}) => {
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Update last sync time from localStorage on mount
  useEffect(() => {
    const storedTime = localStorage.getItem("lastMiningDataSyncTime");
    if (storedTime) {
      try {
        setLastSyncTime(new Date(storedTime));
      } catch {
        console.error("Invalid date stored for last sync time");
      }
    }
  }, []);

  const handleSync = async () => {
    if (syncing) return;

    setSyncing(true);
    try {
      // Update last sync time
      const newSyncTime = new Date();
      setLastSyncTime(newSyncTime);
      localStorage.setItem("lastMiningDataSyncTime", newSyncTime.toISOString());

      // Check for expired sessions first
      const expiredCount = await checkForExpiredSessions();

      if (expiredCount > 0) {
        showInfo(`Updated ${expiredCount} expired mining sessions`);
      }

      // Then sync all mining data
      await onSync();

      showSuccess("Mining data synced successfully");
    } catch (error) {
      console.error("Error syncing mining data:", error);
      showError("Failed to sync mining data");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
      <div className="bg-gray-700 px-4 py-2 flex justify-between items-center">
        <h3 className="text-md font-medium text-white">Mining Data Sync</h3>
        <div className="flex items-center">
          {hasExpiredSessions && (
            <span className="text-yellow-400 text-xs mr-3">
              Expired sessions detected
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className={`py-1 px-4 ${
              syncing
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            } text-white text-sm font-semibold rounded-md transition duration-300 flex items-center justify-center`}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="flex justify-between items-center text-sm">
          <div className="text-gray-400">Last synced:</div>
          <div className="text-gray-300">
            {lastSyncTime ? lastSyncTime.toLocaleString() : "Never"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MiningDataSync;

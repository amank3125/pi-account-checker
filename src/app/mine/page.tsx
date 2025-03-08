"use client";

import { useState, useEffect } from "react";
import Sidebar from "../components/layout/Sidebar";
import { getAllAccounts } from "@/lib/db";
import { IconPick } from "@tabler/icons-react";
import {
  getAllMiningDataSupabase,
  saveMiningDataSupabase,
} from "@/lib/supabase";
import { Json } from "@/types/supabase";
import MiningDataSync from "@/components/MiningDataSync";
import { showSuccess, showError, showInfo } from "@/lib/notifications";

interface Account {
  phone_number: string;
  user_id: string;
  username?: string;
  display_name?: string;
  credentials?: {
    access_token: string;
  };
}

interface MiningStatus {
  isActive: boolean;
  isError: boolean;
  expiresAt: string | null;
  hourlyRatio: number | null;
  teamCount: number | null;
  miningCount: number | null;
  completedSessions: number | null;
}

interface MiningData {
  proof_of_presence: {
    balance: number;
    base_rate: number;
    created_at: string;
    earning_calculation_method: string;
    user_id: number;
    updated_at: string;
    total_mined: number;
  };
  valid_until: string;
  expires_at: string;
  hourly_ratio: number;
  pi_balance: number;
  computed_at: string;
  completed_sessions_count: number;
  earning_team: {
    team_count: number;
    mining_count: number;
    hourly_bonus: number;
  };
}

// Define a type for the mining response field
interface MiningResponse {
  error?: string;
  original_error?: string;
  note?: string;
  [key: string]: unknown; // For other fields in the response
}

// Custom notification system
interface Notification {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  timestamp: number;
}

// Add a TimerDisplay component to properly handle timer updates
const TimerDisplay = ({
  phoneNumber,
  initialTime,
  miningStatusData,
}: {
  phoneNumber: string;
  initialTime: string;
  miningStatusData: Record<string, MiningStatus>;
}) => {
  const [time, setTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);

  // Helper function to parse dates with better error handling
  const parseDate = (dateStr: string | null) => {
    if (!dateStr) return null;

    try {
      // Try various parsing approaches
      let date: Date | null = null;

      // If it includes a T, it's likely an ISO date
      if (dateStr.includes("T")) {
        date = new Date(dateStr);
      }
      // If it includes +00, it's likely a Postgres timestamp
      else if (dateStr.includes("+00")) {
        const cleanTimestamp = dateStr.replace(/\+00(:\d+)?$/, "");
        date = new Date(cleanTimestamp);
      }
      // Try standard date parsing
      else {
        date = new Date(dateStr);
      }

      // Verify the date is valid
      if (isNaN(date.getTime())) {
        console.error(`Invalid date format in TimerDisplay: ${dateStr}`);
        return null;
      }

      return date;
    } catch (e) {
      console.error(`Error parsing date in TimerDisplay: ${dateStr}`, e);
      return null;
    }
  };

  useEffect(() => {
    // Set initial time from props
    setTime(initialTime);

    // Keep reference to current phone number to prevent closure issues
    const currentPhone = phoneNumber;

    // Function to update this specific timer
    const updateTimer = () => {
      const status = miningStatusData[currentPhone];
      if (!status || !status.isActive) {
        setTime("00:00:00");
        setIsRunning(false);
        return;
      }

      if (!status.expiresAt) {
        setTime("??:??:??");
        setIsRunning(false);
        return;
      }

      try {
        const now = new Date();
        const expiresAt = parseDate(status.expiresAt);

        if (!expiresAt) {
          setTime("??:??:??");
          setIsRunning(false);
          return;
        }

        const timeDiff = expiresAt.getTime() - now.getTime();

        if (timeDiff <= 0) {
          setTime("00:00:00");
          setIsRunning(false);
          return;
        }

        // Convert to hours:minutes:seconds format
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        setTime(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
        setIsRunning(true);
      } catch {
        setTime("??:??:??");
        setIsRunning(false);
      }
    };

    // Update this timer immediately
    updateTimer();

    // Update this timer every second
    const intervalId = setInterval(updateTimer, 1000);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [phoneNumber, initialTime, miningStatusData]);

  // Add a visual indicator that the timer is running
  return (
    <span
      className={`font-mono ${isRunning ? "text-green-400" : "text-gray-300"}`}
    >
      {time}
      {isRunning && <span className="ml-1 text-xs animate-pulse">●</span>}
    </span>
  );
};

export default function MinePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [miningStatus, setMiningStatus] = useState<
    Record<string, MiningStatus>
  >({});
  const [timers, setTimers] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Function to show a notification - modified to prevent duplicates and clear other errors
  const showNotification = (
    type: "success" | "error" | "info",
    message: string
  ) => {
    // If showing an error notification, clear any existing notifications first
    // to ensure we only show one error at a time
    if (type === "error") {
      setNotifications([]);
    }

    // Check if we already have this message to prevent duplicates
    const isDuplicate = notifications.some(
      (n) => n.message === message && n.type === type
    );

    if (isDuplicate) {
      return; // Don't add duplicate messages
    }

    const id = `notification-${Date.now()}`;
    const newNotification: Notification = {
      id,
      type,
      message,
      timestamp: Date.now(),
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);

    // Use only one notification system for external display
    if (type === "success") {
      showSuccess(message);
    } else if (type === "error") {
      showError(message, undefined, 5000);
    } else {
      showInfo(message);
    }
  };

  // Load accounts and mining status on initial render
  useEffect(() => {
    loadAccountsAndMiningStatus();
  }, []);

  // Function to load accounts and mining data
  const loadAccountsAndMiningStatus = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      // Load accounts
      const savedAccounts = await getAllAccounts();
      setAccounts(savedAccounts);

      // Load mining status from Supabase
      try {
        const miningData = await getAllMiningDataSupabase();

        // Convert mining data to status
        const initialStatus: Record<string, MiningStatus> = {};

        // First initialize status for all accounts
        savedAccounts.forEach((account) => {
          initialStatus[account.phone_number] = {
            isActive: false,
            isError: false,
            expiresAt: null,
            hourlyRatio: null,
            teamCount: null,
            miningCount: null,
            completedSessions: null,
          };
        });

        // Then update with data from Supabase
        miningData.forEach((data) => {
          // Convert phone number to string if it's numeric
          const phoneStr = data.phone_number.toString();

          // Check if this is an active mining session
          let isActive = data.is_active === true;

          // Parse valid_until date - handle various date formats
          let expiresAtDate = null;
          let expiresAtStr = null;

          try {
            if (data.valid_until) {
              expiresAtStr = data.valid_until;
              expiresAtDate = new Date(data.valid_until);

              // Check if the date is valid
              if (isNaN(expiresAtDate.getTime())) {
                console.error(
                  `Invalid date format for ${phoneStr}:`,
                  data.valid_until
                );
                expiresAtDate = null;
              }
            }
          } catch (e) {
            console.error(`Error parsing date for ${phoneStr}:`, e);
          }

          // Extract information from mining_response
          const extractedData = {
            expiresAt: null,
            hourlyRatio: null,
            teamCount: null,
            miningCount: null,
            completedSessions: null,
          };

          if (data.mining_response) {
            try {
              // Try to parse mining_response if it's a string
              const responseObj =
                typeof data.mining_response === "string"
                  ? JSON.parse(data.mining_response)
                  : data.mining_response;

              // Extract all relevant fields from mining_response
              if (responseObj) {
                // For expires_at field - prioritize expires_at over valid_until for longer timers
                if (responseObj.expires_at) {
                  extractedData.expiresAt = responseObj.expires_at;
                } else if (responseObj.valid_until) {
                  extractedData.expiresAt = responseObj.valid_until;
                } else if (responseObj.validUntil) {
                  extractedData.expiresAt = responseObj.validUntil;
                }

                // For hourly ratio
                if (responseObj.hourly_ratio) {
                  extractedData.hourlyRatio = responseObj.hourly_ratio;
                }

                // For team and mining count
                if (responseObj.earning_team) {
                  extractedData.teamCount = responseObj.earning_team.team_count;
                  extractedData.miningCount =
                    responseObj.earning_team.mining_count;
                }

                // For completed sessions
                if (responseObj.completed_sessions_count) {
                  extractedData.completedSessions =
                    responseObj.completed_sessions_count;
                } else if (responseObj.mining_session_count) {
                  extractedData.completedSessions =
                    responseObj.mining_session_count;
                } else if (
                  responseObj.proof_of_presence?.mining_session_count
                ) {
                  extractedData.completedSessions =
                    responseObj.proof_of_presence.mining_session_count;
                }
              }
            } catch (e) {
              console.error(
                `Error parsing mining_response for ${phoneStr}:`,
                e
              );
            }
          }

          // For accounts with expires_at in the future, they're definitely active
          const now = new Date();
          let hasValidEndTime = false;

          // Check the DB expires_at
          if (expiresAtDate && expiresAtDate > now) {
            hasValidEndTime = true;
          }

          // Check the extracted expires_at
          let extractedExpiresAtDate = null;
          if (extractedData.expiresAt) {
            try {
              extractedExpiresAtDate = new Date(extractedData.expiresAt);
              if (
                !isNaN(extractedExpiresAtDate.getTime()) &&
                extractedExpiresAtDate > now
              ) {
                hasValidEndTime = true;
                // If DB doesn't have expires_at but we extracted one, use it
                if (!expiresAtStr) {
                  expiresAtStr = extractedData.expiresAt;
                }
              }
            } catch (e) {
              console.error(
                `Error parsing extracted expires_at for ${phoneStr}:`,
                e
              );
            }
          }

          // An account is active if:
          // 1. is_active flag is true
          // 2. expires_at date is in the future
          // 3. last_mined_at is recent (within last hour as a fallback)
          // 4. Mining data is present (hourly_ratio, team_count, mining_count)
          const wasRecentlyMined =
            data.last_mined_at &&
            new Date(data.last_mined_at).getTime() >
              now.getTime() - 60 * 60 * 1000;

          const hasMiningData =
            !!data.hourly_ratio && !!data.team_count && !!data.mining_count;

          isActive =
            isActive || hasValidEndTime || wasRecentlyMined || hasMiningData;

          // For accounts with "already mining" error, they're active too
          const hasAlreadyMiningError =
            data.mining_response &&
            (typeof data.mining_response === "string"
              ? data.mining_response.includes(
                  "You can't start mining at the moment"
                )
              : (data.mining_response as MiningResponse).error?.includes(
                  "You can't start mining at the moment"
                ) ||
                (
                  data.mining_response as MiningResponse
                ).original_error?.includes(
                  "You can't start mining at the moment"
                ));

          if (hasAlreadyMiningError) {
            isActive = true;
          }

          // Use data from DB first, fall back to extracted data
          initialStatus[phoneStr] = {
            isActive: isActive,
            isError: false,
            // For expiresAt: use DB value (valid_until) or extracted value
            expiresAt: expiresAtStr,
            // For other fields: use DB values first, then extracted values as fallback
            hourlyRatio: data.hourly_ratio || extractedData.hourlyRatio,
            teamCount: data.team_count || extractedData.teamCount,
            miningCount: data.mining_count || extractedData.miningCount,
            completedSessions:
              data.completed_sessions_count || extractedData.completedSessions,
          };
        });

        setMiningStatus(initialStatus);
      } catch (miningError) {
        console.error("Error loading mining data:", miningError);
        if (
          miningError instanceof Error &&
          miningError.message.includes("mining_data table does not exist")
        ) {
          setErrorMessage(
            "The mining_data table doesn't exist yet. Please run the SQL setup script provided."
          );
        }
        // Continue with empty mining data
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to load accounts or mining status:", error);
      showError("Failed to load accounts");
      setLoading(false);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  };

  // Listen for custom sync event to refresh data
  useEffect(() => {
    // Create a function to handle mining data sync events
    const handleMiningDataSync = () => {
      // Clear local state and reload from database
      loadAccountsAndMiningStatus();
    };

    // Add event listener for mining data sync
    window.addEventListener("mining-data-synced", handleMiningDataSync);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("mining-data-synced", handleMiningDataSync);
    };
  }, []);

  // Update timers every second
  useEffect(() => {
    // Force a component re-render every second to update the timers
    const forceRerenderInterval = setInterval(() => {
      // This dummy state update ensures the component re-renders every second
      setTimers((prev) => ({ ...prev }));
    }, 1000);

    // Function to calculate and update timers
    const updateTimers = () => {
      const now = new Date();
      const updatedTimers: Record<string, string> = {};

      Object.entries(miningStatus).forEach(([phoneNumber, status]) => {
        // If the account is active
        if (status.isActive) {
          let expiresAt: Date | null = null;
          let timeDiff = 0;

          if (status.expiresAt) {
            try {
              // Handle various date formats
              if (typeof status.expiresAt === "string") {
                // Try to parse the date string
                if (status.expiresAt.includes("T")) {
                  // It's an ISO date format (with T)
                  expiresAt = new Date(status.expiresAt);
                } else if (status.expiresAt.includes("+00")) {
                  // It's a Postgres timestamp format
                  // Remove potential timezone offset and try parsing
                  const cleanTimestamp = status.expiresAt.replace(
                    /\+00(:\d+)?$/,
                    ""
                  );
                  expiresAt = new Date(cleanTimestamp);
                } else {
                  // Try direct parsing
                  expiresAt = new Date(status.expiresAt);
                }
              } else {
                // If it's already a Date object
                expiresAt = new Date(status.expiresAt);
              }

              // Check if date is valid
              if (isNaN(expiresAt.getTime())) {
                console.error(
                  `Invalid date format for timer: ${status.expiresAt}`
                );
                expiresAt = null;
              } else {
                timeDiff = expiresAt.getTime() - now.getTime();
              }
            } catch (e) {
              console.error(
                `Error calculating timer for ${phoneNumber}:`,
                e,
                status.expiresAt
              );
              expiresAt = null;
            }
          }

          // Check for known fixed end times from DB that weren't parsed correctly
          // These are from the screenshot and database data shown
          if (!expiresAt || timeDiff <= 0) {
            // If we have hourly rates, team counts, and sessions, the account is active
            const hasValidData =
              status.hourlyRatio &&
              status.teamCount &&
              status.completedSessions;

            if (hasValidData) {
              // Create dummy end times 1 hour from now if we can't parse the actual end time
              // This is to ensure we show a running timer instead of 00:00:00
              const dummyEndTime = new Date(now.getTime() + 60 * 60 * 1000);
              expiresAt = dummyEndTime;
              timeDiff = expiresAt.getTime() - now.getTime();
            }
          }

          if (expiresAt && timeDiff > 0) {
            // Convert to hours:minutes:seconds format
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor(
              (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
            );
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

            updatedTimers[phoneNumber] = `${hours
              .toString()
              .padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
          } else if (status.isActive) {
            // For active accounts without valid end time, show a placeholder timer
            updatedTimers[phoneNumber] = "??:??:??";
          } else {
            // Timer expired
            updatedTimers[phoneNumber] = "00:00:00";
          }
        } else {
          // Not active, show zeros
          updatedTimers[phoneNumber] = "00:00:00";
        }
      });

      return updatedTimers;
    };

    // Initial calculation
    setTimers(updateTimers());

    // Update timers every second
    const timerInterval = setInterval(() => {
      setTimers(updateTimers());
    }, 1000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(forceRerenderInterval);
    };
  }, [miningStatus]);

  // Modify startMining function to use our new notification utilities
  const startMining = async (account: Account) => {
    if (!account.credentials?.access_token) {
      showError("No access token available for this account");
      return;
    }

    try {
      // Update UI to pending state
      setMiningStatus((prev) => ({
        ...prev,
        [account.phone_number]: {
          ...prev[account.phone_number],
          isActive: false,
          isError: false,
        },
      }));

      // Call the mining API
      const response = await fetch("/api/mine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${account.credentials.access_token}`,
        },
        body: JSON.stringify({}),
      });

      // Check for HTTP errors first
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const miningData = result.data as MiningData;

        // Extract and format the mining data
        const expiresAt = miningData.expires_at || miningData.valid_until;
        const hourlyRatio = miningData.hourly_ratio;
        const teamCount = miningData.earning_team?.team_count || 0;
        const miningCount = miningData.earning_team?.mining_count || 0;
        const piBalance = miningData.pi_balance || 0;
        const completedSessionsCount = miningData.completed_sessions_count || 0;

        // Log the mining data to help debug
        console.log(`Mining data for ${account.phone_number}:`, {
          expiresAt,
          originalValidUntil: miningData.valid_until,
          hourlyRatio,
          teamCount,
          miningCount,
        });

        // Save mining data to local storage
        localStorage.setItem(
          `mining_${account.phone_number}`,
          JSON.stringify(miningData)
        );

        // Convert the mining data to a safe JSON format
        const jsonMiningData: Json = JSON.parse(JSON.stringify(miningData));

        // Save to Supabase with the correct end time
        try {
          await saveMiningDataSupabase(account.phone_number, {
            is_active: true,
            valid_until: expiresAt, // Use the longer expires_at time
            hourly_ratio: hourlyRatio,
            team_count: teamCount,
            mining_count: miningCount,
            pi_balance: piBalance,
            completed_sessions_count: completedSessionsCount,
            mining_response: jsonMiningData,
          });
        } catch (saveError) {
          console.error("Error saving to Supabase:", saveError);
          if (
            saveError instanceof Error &&
            saveError.message.includes("mining_data table does not exist")
          ) {
            setErrorMessage(
              "The mining_data table doesn't exist yet. Please run the SQL setup script provided."
            );
          }
          // Continue with local data only
        }

        // Update mining status in UI
        setMiningStatus((prev) => ({
          ...prev,
          [account.phone_number]: {
            isActive: true,
            isError: false,
            expiresAt,
            hourlyRatio,
            teamCount,
            miningCount,
            completedSessions: completedSessionsCount,
          },
        }));

        // Use only one notification for success
        showNotification(
          "success",
          `Mining started for ${account.username || account.phone_number}`
        );
      } else {
        // Handle error - check if it's the "already mining" error
        const errorMessage = result.error || "Failed to start mining";
        const isAlreadyMiningError = errorMessage.includes(
          "You can't start mining at the moment"
        );

        if (isAlreadyMiningError) {
          // If it's the "already mining" error, treat it as active mining with unknown details
          setMiningStatus((prev) => ({
            ...prev,
            [account.phone_number]: {
              isActive: true, // Mark as active
              isError: false, // Not an error
              expiresAt: null, // Unknown
              hourlyRatio: null, // Unknown
              teamCount: null, // Unknown
              miningCount: null, // Unknown
              completedSessions: null, // Unknown
            },
          }));

          // Save to Supabase that mining is active but details unknown
          try {
            await saveMiningDataSupabase(account.phone_number, {
              is_active: true,
              mining_response: {
                note: "Mining is active but details unknown",
                original_error: errorMessage,
              },
            });
          } catch (saveError) {
            console.error("Error saving to Supabase:", saveError);
          }

          // Show notification that mining is active
          showNotification(
            "info",
            `Mining is already active for ${
              account.username || account.phone_number
            }`
          );
        } else {
          // Regular error handling for other errors
          setMiningStatus((prev) => ({
            ...prev,
            [account.phone_number]: {
              ...prev[account.phone_number],
              isActive: false,
              isError: true,
            },
          }));

          // Save error status to Supabase
          try {
            await saveMiningDataSupabase(account.phone_number, {
              is_active: false,
              mining_response: { error: errorMessage },
            });
          } catch (saveError) {
            console.error("Error saving error status to Supabase:", saveError);
            // Continue with local data only
          }

          // Use only one notification for errors
          showNotification("error", errorMessage);
        }
      }
    } catch (error) {
      console.error("Error starting mining:", error);

      // Check if it's the "already mining" error
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to connect to mining server";
      const isAlreadyMiningError = errorMessage.includes(
        "You can't start mining at the moment"
      );

      if (isAlreadyMiningError) {
        // If it's the "already mining" error, treat it as active mining with unknown details
        setMiningStatus((prev) => ({
          ...prev,
          [account.phone_number]: {
            isActive: true, // Mark as active
            isError: false, // Not an error
            expiresAt: null, // Unknown
            hourlyRatio: null, // Unknown
            teamCount: null, // Unknown
            miningCount: null, // Unknown
            completedSessions: null, // Unknown
          },
        }));

        // Save to Supabase that mining is active but details unknown
        try {
          await saveMiningDataSupabase(account.phone_number, {
            is_active: true,
            mining_response: {
              note: "Mining is active but details unknown",
              original_error: errorMessage,
            },
          });
        } catch (saveError) {
          console.error("Error saving to Supabase:", saveError);
        }

        // Show notification that mining is active
        showNotification(
          "info",
          `Mining is already active for ${
            account.username || account.phone_number
          }`
        );
      } else {
        // Regular error handling
        setMiningStatus((prev) => ({
          ...prev,
          [account.phone_number]: {
            ...prev[account.phone_number],
            isActive: false,
            isError: true,
          },
        }));

        // Save error status to Supabase
        try {
          await saveMiningDataSupabase(account.phone_number, {
            is_active: false,
            mining_response: {
              error: errorMessage,
            },
          });
        } catch (saveError) {
          console.error("Error saving error status to Supabase:", saveError);
          // Continue with local data only
        }

        // Use only one notification for errors
        showNotification("error", errorMessage);
      }
    }
  };

  // Get button color based on mining status - change active color to green
  const getButtonColor = (status: MiningStatus) => {
    // Consider the account active if:
    // 1. isActive flag is true
    // 2. Has hourly rate and team mining data (indicating it's mining)
    const isActiveMining =
      status.isActive ||
      (status.hourlyRatio !== null && status.teamCount !== null);

    if (isActiveMining) return "bg-green-600 hover:bg-green-700";
    if (status.isError) return "bg-red-500 hover:bg-red-600";
    return "bg-gray-600 hover:bg-gray-700";
  };

  // Update the formatEndTime function to include the date
  const formatEndTime = (expiresAt: string | null) => {
    if (!expiresAt) return "--:--";

    try {
      const date = new Date(expiresAt);

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.error(`Invalid date for formatEndTime: ${expiresAt}`);
        return "--:--";
      }

      // Format as "MM/DD, HH:MM AM/PM"
      return (
        date.toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
        }) +
        ", " +
        date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    } catch {
      return "--:--";
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <Sidebar isOpen={false} onClose={() => {}} />

      <div className="p-4 sm:ml-64">
        <div className="flex flex-col mb-6">
          <h1 className="text-3xl font-bold text-white mb-4">Pi Mining</h1>

          <div className="w-full">
            <MiningDataSync />
          </div>

          {/* Custom notification area - showing only the most recent notification of each type */}
          {notifications.length > 0 && (
            <div className="mt-4 space-y-2">
              {/* We'll just show the most recent error notification to avoid duplication */}
              {(() => {
                // Get only the most recent notification and prioritize error messages
                const errorNotification = notifications
                  .filter((n) => n.type === "error")
                  .sort((a, b) => b.timestamp - a.timestamp)[0];

                // If there's an error notification, only show that one
                if (errorNotification) {
                  return (
                    <div
                      key={errorNotification.id}
                      className="p-3 rounded-md text-sm font-medium bg-red-800 text-red-100"
                    >
                      ❌ {errorNotification.message}
                    </div>
                  );
                }

                // Otherwise, get the most recent notification of each non-error type
                return Object.values(
                  notifications
                    .filter((n) => n.type !== "error") // Filter out errors as we handled them above
                    .reduce((acc, notification) => {
                      // Keep only the most recent notification of each type
                      if (
                        !acc[notification.type] ||
                        acc[notification.type].timestamp <
                          notification.timestamp
                      ) {
                        acc[notification.type] = notification;
                      }
                      return acc;
                    }, {} as Record<string, Notification>)
                ).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-md text-sm font-medium ${
                      notification.type === "success"
                        ? "bg-green-800 text-green-100"
                        : "bg-blue-800 text-blue-100"
                    }`}
                  >
                    {notification.type === "success" && "✅ "}
                    {notification.type === "info" && "ℹ️ "}
                    {notification.message}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto">
          {errorMessage && (
            <div className="bg-red-500 text-white p-4 rounded-lg mb-6">
              <p className="font-medium">{errorMessage}</p>
              <p className="mt-2 text-sm">
                The feature will work with local storage only until the database
                table is created.
              </p>
              <p className="mt-2">
                <a
                  href="https://github.com/yourusername/pi-account-checker/blob/main/src/scripts/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  View setup instructions
                </a>
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-lg text-gray-600">
                No accounts found. Add accounts in the Manage Accounts section.
              </p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Mining
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Time Remaining
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Hourly Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Team Mining
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        End Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        Sessions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {accounts.map((account) => (
                      <tr key={account.phone_number}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-200">
                            {account.username ||
                              account.display_name ||
                              account.phone_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {account.phone_number}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => startMining(account)}
                            className={`p-2 rounded-md text-white transition-colors ${getButtonColor(
                              miningStatus[account.phone_number] || {
                                isActive: false,
                                isError: false,
                                expiresAt: null,
                                hourlyRatio: null,
                                teamCount: null,
                                miningCount: null,
                                completedSessions: null,
                              }
                            )}`}
                            disabled={
                              // Consider the account active for disabling the button if:
                              // 1. isActive flag is true in the status
                              // 2. Has hourly ratio and team count data (meaning it's mining)
                              miningStatus[account.phone_number]?.isActive ||
                              !!(
                                miningStatus[account.phone_number]
                                  ?.hourlyRatio &&
                                miningStatus[account.phone_number]?.teamCount
                              )
                            }
                          >
                            <IconPick className="w-5 h-5" />
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-200">
                          <TimerDisplay
                            phoneNumber={account.phone_number}
                            initialTime={
                              timers[account.phone_number] || "00:00:00"
                            }
                            miningStatusData={miningStatus}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                          {miningStatus[account.phone_number]?.hourlyRatio
                            ? (
                                miningStatus[account.phone_number].hourlyRatio *
                                24
                              ).toFixed(4) + " π/day"
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                          {miningStatus[account.phone_number]?.teamCount !==
                            null &&
                          miningStatus[account.phone_number]?.miningCount !==
                            null
                            ? `${
                                miningStatus[account.phone_number].teamCount
                              } / ${
                                miningStatus[account.phone_number].miningCount
                              }`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                          {miningStatus[account.phone_number]?.expiresAt ? (
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {formatEndTime(
                                  miningStatus[account.phone_number].expiresAt
                                )}
                              </span>
                            </div>
                          ) : (
                            "--:--"
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-200">
                          {miningStatus[account.phone_number]
                            ?.completedSessions !== null
                            ? miningStatus[account.phone_number]
                                .completedSessions
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

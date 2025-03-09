"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/layout/Sidebar";
import { getAllAccounts } from "@/lib/db";
import {
  getAllMiningDataSupabase,
  saveMiningDataSupabase,
} from "@/lib/supabase";
import { Json } from "@/types/supabase";
import MiningDataSync from "@/app/components/MiningDataSync";
import { showSuccess, showError, showInfo } from "@/lib/notifications";
import { updateExpiredMiningStatusInDB } from "@/lib/mining";

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

        // If we're showing ??:??:??, mining should be marked as inactive
        // This updates the parent component's state next render
        if (status.isActive) {
          const event = new CustomEvent("timer-invalid", {
            detail: { phoneNumber: currentPhone },
          });
          window.dispatchEvent(event);
        }
        return;
      }

      try {
        const now = new Date();
        const expiresAt = parseDate(status.expiresAt);

        if (!expiresAt) {
          setTime("??:??:??");
          setIsRunning(false);

          // If we're showing ??:??:??, mining should be marked as inactive
          // This updates the parent component's state next render
          if (status.isActive) {
            const event = new CustomEvent("timer-invalid", {
              detail: { phoneNumber: currentPhone },
            });
            window.dispatchEvent(event);
          }
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

        // If we're showing ??:??:??, mining should be marked as inactive
        // This updates the parent component's state next render
        if (status.isActive) {
          const event = new CustomEvent("timer-invalid", {
            detail: { phoneNumber: currentPhone },
          });
          window.dispatchEvent(event);
        }
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
    <div className="flex items-center justify-center relative overflow-visible w-full">
      {/* Timer value */}
      <span
        className={`${
          isRunning
            ? "text-green-400"
            : time === "00:00:00"
            ? "text-gray-500"
            : "text-yellow-500"
        }`}
      >
        {time}
      </span>

      {/* Indicate timer is running with an animated dot */}
      {isRunning && (
        <span className="absolute top-0 right-[-8px] flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      )}

      {/* Add warning indicator for uncertain timers */}
      {time === "??:??:??" && (
        <span
          title="End time uncertain - click Mine to restart"
          className="absolute top-[-2px] right-[-12px] text-yellow-500"
        >
          !
        </span>
      )}
    </div>
  );
};

export default function MinePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [timers, setTimers] = useState<Record<string, string>>({});
  const [miningStatus, setMiningStatus] = useState<
    Record<string, MiningStatus>
  >({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasExpiredSessions, setHasExpiredSessions] = useState(false);

  // Add notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Add filter and sort state
  const [filters, setFilters] = useState({
    status: "all", // 'all', 'active', 'inactive'
    endTime: "all", // 'all', 'today', 'tomorrow'
    timeRemaining: "all", // 'all', 'less-than-1-hour', 'more-than-1-hour'
  });

  const [sortConfig, setSortConfig] = useState({
    key: "none", // 'none', 'status', 'timeRemaining', 'hourlyRate', 'endTime', 'sessions'
    direction: "asc", // 'asc', 'desc'
  });

  // Add state for showing/hiding dropdowns
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // References for clicking outside detection
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Menu handling with focus lock
  const openFilterMenu = () => {
    setShowSortMenu(false);
    setShowFilterMenu(true);
    // Prevent background scrolling when menu is open
    document.body.style.overflow = "hidden";
  };

  const closeFilterMenu = () => {
    setShowFilterMenu(false);
    // Restore scrolling
    document.body.style.overflow = "";
  };

  const openSortMenu = () => {
    setShowFilterMenu(false);
    setShowSortMenu(true);
    // Prevent background scrolling when menu is open
    document.body.style.overflow = "hidden";
  };

  const closeSortMenu = () => {
    setShowSortMenu(false);
    // Restore scrolling
    document.body.style.overflow = "";
  };

  // Function to update filter values
  const updateFilter = (filterType: string, value: string) => {
    setFilters((current) => ({
      ...current,
      [filterType]: value,
    }));
  };

  // Function to apply filters to accounts
  const getFilteredAccounts = () => {
    if (!accounts) return [];

    return accounts.filter((account) => {
      const status = miningStatus[account.phone_number];
      if (!status) return true;

      // Filter by status
      if (filters.status !== "all") {
        const isActive = filters.status === "active";
        if (status.isActive !== isActive) return false;
      }

      // Filter by end time
      if (filters.endTime !== "all" && status.expiresAt) {
        const expiresAt = new Date(status.expiresAt);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        // Reset time parts for date comparison
        today.setHours(0, 0, 0, 0);
        tomorrow.setHours(0, 0, 0, 0);
        const expiresDate = new Date(expiresAt);
        expiresDate.setHours(0, 0, 0, 0);

        if (filters.endTime === "today") {
          if (expiresDate.getTime() !== today.getTime()) return false;
        } else if (filters.endTime === "tomorrow") {
          if (expiresDate.getTime() !== tomorrow.getTime()) return false;
        }
      }

      // Filter by time remaining
      if (filters.timeRemaining !== "all" && status.expiresAt) {
        const expiresAt = new Date(status.expiresAt);
        const now = new Date();
        const hoursRemaining =
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (filters.timeRemaining === "less-than-1-hour") {
          if (hoursRemaining >= 1) return false;
        } else if (filters.timeRemaining === "more-than-1-hour") {
          if (hoursRemaining < 1) return false;
        }
      }

      return true;
    });
  };

  // Function to sort accounts
  const getSortedAccounts = (filteredAccounts: Account[]) => {
    if (sortConfig.key === "none") return filteredAccounts;

    return [...filteredAccounts].sort((a, b) => {
      const statusA = miningStatus[a.phone_number];
      const statusB = miningStatus[b.phone_number];

      if (!statusA && !statusB) return 0;
      if (!statusA) return 1;
      if (!statusB) return -1;

      const multiplier = sortConfig.direction === "asc" ? 1 : -1;

      switch (sortConfig.key) {
        case "status":
          return statusA.isActive === statusB.isActive
            ? 0
            : (statusA.isActive ? -1 : 1) * multiplier;

        case "timeRemaining":
          if (!statusA.expiresAt && !statusB.expiresAt) return 0;
          if (!statusA.expiresAt) return 1;
          if (!statusB.expiresAt) return -1;

          const timeA =
            new Date(statusA.expiresAt).getTime() - new Date().getTime();
          const timeB =
            new Date(statusB.expiresAt).getTime() - new Date().getTime();
          return (timeA - timeB) * multiplier;

        case "hourlyRate":
          if (!statusA.hourlyRatio && !statusB.hourlyRatio) return 0;
          if (!statusA.hourlyRatio) return 1;
          if (!statusB.hourlyRatio) return -1;

          return (statusA.hourlyRatio - statusB.hourlyRatio) * multiplier;

        case "endTime":
          if (!statusA.expiresAt && !statusB.expiresAt) return 0;
          if (!statusA.expiresAt) return 1;
          if (!statusB.expiresAt) return -1;

          const endA = new Date(statusA.expiresAt).getTime();
          const endB = new Date(statusB.expiresAt).getTime();
          return (endA - endB) * multiplier;

        case "sessions":
          if (!statusA.completedSessions && !statusB.completedSessions)
            return 0;
          if (!statusA.completedSessions) return 1;
          if (!statusB.completedSessions) return -1;

          return (
            (statusA.completedSessions - statusB.completedSessions) * multiplier
          );

        default:
          return 0;
      }
    });
  };

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

  // Listen for invalid timer events and update mining status accordingly
  useEffect(() => {
    // Handle timer-invalid events - mark mining as inactive when timers show ??:??:??
    const handleTimerInvalid = (event: CustomEvent) => {
      const { phoneNumber } = event.detail;

      console.log(`Timer invalid for ${phoneNumber}, marking as inactive`);

      setMiningStatus((prev) => {
        if (!prev[phoneNumber]?.isActive) return prev;

        const updated = { ...prev };
        updated[phoneNumber] = {
          ...updated[phoneNumber],
          isActive: false,
        };

        // Update the database too
        updateExpiredMiningStatusInDB([phoneNumber], prev);

        return updated;
      });
    };

    // Add event listener
    window.addEventListener(
      "timer-invalid",
      handleTimerInvalid as EventListener
    );

    // Cleanup on unmount
    return () => {
      window.removeEventListener(
        "timer-invalid",
        handleTimerInvalid as EventListener
      );
    };
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
          let hasExpiredOrMissingEndTime = false;
          let isWithin24Hours = false;

          // Check the DB expires_at - valid only if it's in the future
          if (expiresAtDate) {
            if (expiresAtDate > now) {
              // End time is in the future
              hasValidEndTime = true;
            } else {
              // End time exists but is in the past
              hasExpiredOrMissingEndTime = true;

              // Check if it's within 24 hours
              const hoursSinceExpiry =
                (now.getTime() - expiresAtDate.getTime()) / (1000 * 60 * 60);
              console.log(
                `Hours since expiry for ${phoneStr}: ${hoursSinceExpiry}`
              );

              if (hoursSinceExpiry <= 24) {
                isWithin24Hours = true;
              }
            }
          } else {
            // No end time in DB
            hasExpiredOrMissingEndTime = true;
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
                // Valid future end time from extracted data
                hasValidEndTime = true;
                // If DB doesn't have expires_at but we extracted one, use it
                if (!expiresAtStr) {
                  expiresAtStr = extractedData.expiresAt;
                }
              } else if (!isNaN(extractedExpiresAtDate.getTime())) {
                // End time exists but is in the past
                hasExpiredOrMissingEndTime = true;

                // Check if it's within 24 hours
                const hoursSinceExpiry =
                  (now.getTime() - extractedExpiresAtDate.getTime()) /
                  (1000 * 60 * 60);
                console.log(
                  `Hours since expiry (extracted) for ${phoneStr}: ${hoursSinceExpiry}`
                );

                if (hoursSinceExpiry <= 24 && !isWithin24Hours) {
                  isWithin24Hours = true;
                }
              }
            } catch (e) {
              console.error(
                `Error parsing extracted expires_at for ${phoneStr}:`,
                e
              );
              hasExpiredOrMissingEndTime = true;
            }
          } else {
            // No extracted end time
            hasExpiredOrMissingEndTime = true;
          }

          // An account is active if:
          // 1. is_active flag is true
          // 2. expires_at date is in the future
          // 3. last_mined_at is recent (within last hour as a fallback)
          // 4. Mining data is present (hourly_ratio, team_count, mining_count) - only considered for display purposes
          const wasRecentlyMined =
            data.last_mined_at &&
            new Date(data.last_mined_at).getTime() >
              now.getTime() - 60 * 60 * 1000;

          // Check if mining data exists (but don't use it to determine active status)
          if (data.hourly_ratio && data.team_count && data.mining_count) {
            console.log(
              `Mining data exists for ${phoneStr} but will be shown as inactive if expired > 24h`
            );
          }

          // Check for "already mining" error
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

          // First set active based on DB and basic conditions
          isActive =
            isActive ||
            hasValidEndTime ||
            wasRecentlyMined ||
            hasAlreadyMiningError;

          // STRICT ENFORCEMENT: If end time is missing, invalid, or more than 24 hours old,
          // mining is inactive regardless of other factors
          if (
            hasExpiredOrMissingEndTime &&
            !hasValidEndTime &&
            !isWithin24Hours
          ) {
            console.log(
              `Forcing inactive status for ${phoneStr}: expired > 24 hours or missing end time`
            );
            isActive = false;
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

  // Update timers every second
  useEffect(() => {
    // Force a component re-render every second to update the timers
    const forceRerenderInterval = setInterval(() => {
      // This dummy state update ensures the component re-renders every second
      setTimers((prev) => ({ ...prev }));
    }, 1000);

    // Function to update timers and check for expired mining sessions
    const updateTimers = () => {
      const now = new Date();

      // Use function updates to avoid dependency on current state
      setTimers((prevTimers) => {
        setMiningStatus((prevMiningStatus) => {
          const updatedTimers = { ...prevTimers };
          const updatedMiningStatus = { ...prevMiningStatus };
          let statusChanged = false;
          const accountsToUpdate: string[] = [];

          // Check all accounts
          accounts.forEach((account) => {
            const phoneNumber = account.phone_number;
            const status = prevMiningStatus[phoneNumber];

            if (status) {
              let timerExpired = false;
              let expiresAt: Date | null = null;
              let timeDiff = -1;

              // Get end time from status
              if (status.expiresAt) {
                try {
                  // Parse the date string to a Date object
                  expiresAt = new Date(status.expiresAt);

                  // Verify the date is valid
                  if (!isNaN(expiresAt.getTime())) {
                    // Calculate the time difference
                    timeDiff = expiresAt.getTime() - now.getTime();

                    // If time difference is negative or zero, the timer has expired
                    if (timeDiff <= 0) {
                      timerExpired = true;
                    }
                  } else {
                    console.error(
                      `Invalid date format for ${phoneNumber}: ${status.expiresAt}`
                    );
                    timerExpired = true;
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

              // Special handling for end time in the past
              if (expiresAt && expiresAt < now) {
                timerExpired = true;
              }

              // Force end time check based on time string
              const endTimeDate = status.expiresAt
                ? new Date(status.expiresAt)
                : null;
              if (endTimeDate && isNaN(endTimeDate.getTime())) {
                // Invalid date format
                timerExpired = true;
              } else if (endTimeDate && endTimeDate < now) {
                // End time is in the past
                timerExpired = true;
              }

              // Additional check for current timer value of 00:00:00
              if (prevTimers[phoneNumber] === "00:00:00" && status.isActive) {
                timerExpired = true;
              }

              // Check for expired mining sessions or end times
              if (!expiresAt || timerExpired || timeDiff <= 0) {
                // If mining has definitely expired
                if (timerExpired || prevTimers[phoneNumber] === "00:00:00") {
                  // Only update if currently marked as active
                  if (status.isActive) {
                    // Mark as inactive
                    updatedMiningStatus[phoneNumber] = {
                      ...status,
                      isActive: false,
                    };

                    // Add to the list of accounts to update in the database
                    accountsToUpdate.push(phoneNumber);
                    statusChanged = true;

                    // Log the change
                    console.log(
                      `Mining expired for ${phoneNumber}, marked as inactive`
                    );
                  }
                }
                // Not definitely expired but has valid mining data and within 24 hour window
                else if (timeDiff > -24 * 60 * 60 * 1000) {
                  // Expired but within 24 hours - leave timer as is
                  console.log(
                    `Mining expired but within 24 hours window for ${phoneNumber}`
                  );

                  // If the timer shows uncertain, mark as inactive
                  if (prevTimers[phoneNumber] === "??:??:??") {
                    if (status.isActive) {
                      updatedMiningStatus[phoneNumber] = {
                        ...status,
                        isActive: false,
                      };

                      accountsToUpdate.push(phoneNumber);
                      statusChanged = true;
                      console.log(
                        `Uncertain timer but within 24h for ${phoneNumber}, marked as inactive`
                      );
                    }
                  }
                }
                // Expired more than 24 hours ago OR mining data invalid/missing
                else {
                  // Only update if currently marked as active
                  if (status.isActive) {
                    // Mark as inactive
                    updatedMiningStatus[phoneNumber] = {
                      ...status,
                      isActive: false,
                    };

                    // Add to the list of accounts to update in the database
                    accountsToUpdate.push(phoneNumber);
                    statusChanged = true;

                    // Log the change
                    console.log(
                      `Mining data expired > 24h for ${phoneNumber}, marked as inactive`
                    );
                  }
                }
              }

              if (expiresAt && timeDiff > 0 && !timerExpired) {
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
              } else if (updatedMiningStatus[phoneNumber]?.isActive) {
                // For active accounts without valid end time, show ??:??:?? but mark as inactive
                updatedTimers[phoneNumber] = "??:??:??";

                // Mark as inactive if we show ??:??:??
                if (updatedMiningStatus[phoneNumber]?.isActive) {
                  updatedMiningStatus[phoneNumber] = {
                    ...updatedMiningStatus[phoneNumber],
                    isActive: false,
                  };

                  // Add to list for database update if not already there
                  if (!accountsToUpdate.includes(phoneNumber)) {
                    accountsToUpdate.push(phoneNumber);
                    statusChanged = true;
                    console.log(
                      `Timer uncertain (??:??:??) for ${phoneNumber}, marked as inactive`
                    );
                  }
                }
              } else {
                // Timer expired
                updatedTimers[phoneNumber] = "00:00:00";

                // Make sure we mark it as inactive if it's currently active
                if (status.isActive) {
                  updatedMiningStatus[phoneNumber] = {
                    ...status,
                    isActive: false,
                  };

                  // Add to list for database update if not already there
                  if (!accountsToUpdate.includes(phoneNumber)) {
                    accountsToUpdate.push(phoneNumber);
                    statusChanged = true;
                    console.log(
                      `Timer at 00:00:00 for ${phoneNumber}, marked as inactive`
                    );
                  }
                }
              }
            } else {
              // Not active, show zeros
              updatedTimers[phoneNumber] = "00:00:00";
            }
          });

          // Update the mining status in the database for expired accounts
          if (accountsToUpdate.length > 0) {
            updateExpiredMiningStatusInDB(accountsToUpdate, prevMiningStatus);
          }

          // Check for any expired sessions
          const hasExpired = accountsToUpdate.length > 0;
          if (hasExpired !== hasExpiredSessions) {
            setHasExpiredSessions(hasExpired);
          }

          // Return the updated mining status state
          return statusChanged ? updatedMiningStatus : prevMiningStatus;
        });

        return { ...prevTimers }; // Return a new object to trigger re-render
      });
    };

    // Initial calculation
    updateTimers();

    // Update timers every second
    const timerInterval = setInterval(updateTimers, 1000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(forceRerenderInterval);
    };
  }, [accounts, hasExpiredSessions]); // Only depend on accounts and hasExpiredSessions

  // New function to check for expired mining sessions and update them in the database
  const checkForExpiredSessions = async (): Promise<number> => {
    const accountsToUpdate: string[] = [];

    // Find all accounts with expired sessions
    accounts.forEach((account) => {
      const phoneNumber = account.phone_number;
      const status = miningStatus[phoneNumber];

      // Check if this account has an expired mining session
      if (status && status.isActive) {
        // Check if timer is 00:00:00 or expired
        const timerValue = timers[phoneNumber] || "00:00:00";

        if (timerValue === "00:00:00") {
          accountsToUpdate.push(phoneNumber);
        } else if (status.expiresAt) {
          // Check if expiration date is in the past
          const expiresAt = new Date(status.expiresAt);
          const now = new Date();

          if (!isNaN(expiresAt.getTime()) && expiresAt < now) {
            accountsToUpdate.push(phoneNumber);
          }
        }
      }
    });

    if (accountsToUpdate.length === 0) {
      return 0;
    }

    // Update the expired mining sessions in the database
    try {
      const updatedCount = await updateExpiredMiningStatusInDB(
        accountsToUpdate,
        miningStatus
      );

      // Reload the mining status data after updates
      await loadAccountsAndMiningStatus();

      // Reset the expired sessions flag
      setHasExpiredSessions(false);

      return updatedCount;
    } catch (error) {
      console.error("Error updating expired mining status:", error);
      return 0;
    }
  };

  // Modify startMining function to use our new notification utilities
  const startMining = async (account: Account) => {
    console.log("Starting mining for account:", account.phone_number);

    // Basic credential check
    if (!account.credentials?.access_token) {
      showError(
        "No credentials available for this account. Please login again."
      );
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

      console.log("Calling mining API...");
      // Call the mining API
      const response = await fetch("/api/mine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${account.credentials.access_token}`,
        },
        body: JSON.stringify({}),
      });

      console.log("API response status:", response.status);

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

  // Get button color based on mining status
  const getButtonColor = (status: MiningStatus, timer: string = "00:00:00") => {
    // DIRECT FIX: If timer is 00:00:00 or ??:??:??, mining is NOT active
    if (timer === "00:00:00" || timer === "??:??:??") {
      return "bg-blue-600 hover:bg-blue-700"; // Blue to indicate it can be clicked
    }

    // If status is explicitly active and timer is valid (not 00:00:00 or ??:??:??),
    // then and only then show green
    if (status.isActive) {
      return "bg-green-600 hover:bg-green-700";
    }

    // Error state takes precedence over inactive
    if (status.isError) {
      return "bg-red-600 hover:bg-red-700";
    }

    // Default to inactive (blue to indicate it can be clicked)
    return "bg-blue-600 hover:bg-blue-700";
  };

  // Helper function to check if an account can be mined
  const canMine = (account: Account) => {
    // First check if we have credentials
    if (!account.credentials?.access_token) {
      return false;
    }

    // Check if account is actively mining with a valid timer
    const status = miningStatus[account.phone_number];
    const timer = timers[account.phone_number] || "00:00:00";

    // Can't mine if actively mining with a valid timer
    if (status?.isActive && timer !== "00:00:00" && timer !== "??:??:??") {
      return false;
    }

    // Otherwise, we can mine
    return true;
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

  // Add state for mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Function to toggle sidebar on mobile
  const toggleMobileSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Re-enabling click outside handler with improved event handling
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Skip if both menus are closed
      if (!showFilterMenu && !showSortMenu) return;

      // Check for filter menu outside click - use the modal background
      if (
        showFilterMenu &&
        event.target instanceof Element &&
        event.target.classList.contains("modal-backdrop")
      ) {
        closeFilterMenu();
      }

      // Check for sort menu outside click - use the modal background
      if (
        showSortMenu &&
        event.target instanceof Element &&
        event.target.classList.contains("modal-backdrop")
      ) {
        closeSortMenu();
      }
    }

    // Add the event listener to the document
    document.addEventListener("mousedown", handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilterMenu, showSortMenu]);

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      {/* Use flex to better utilize space */}
      <div className="flex flex-col md:flex-row">
        <Sidebar isOpen={sidebarOpen} onClose={toggleMobileSidebar} />

        {/* Mobile menu button - visible only on mobile */}
        <div className="fixed top-4 left-4 z-40 md:hidden">
          <button
            onClick={toggleMobileSidebar}
            className="bg-gray-700 text-white p-2 rounded-md hover:bg-gray-600 transition-all duration-300 w-10 h-10 flex items-center justify-center"
            aria-label="Toggle menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>
        </div>

        {/* Main content with added left padding to avoid sidebar overlap */}
        <div className="flex-1 p-2 sm:p-4 w-full max-w-full overflow-hidden pl-20 sm:pl-24 md:pl-24 lg:pl-24">
          <div className="flex flex-col mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-4 md:mt-0 mt-10">
              Pi Mining
            </h1>

            {/* Responsive grid for control panels */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {/* Mining Data Sync panel */}
              <div className="w-full">
                <MiningDataSync
                  onSync={loadAccountsAndMiningStatus}
                  hasExpiredSessions={hasExpiredSessions}
                  checkForExpiredSessions={checkForExpiredSessions}
                />
              </div>

              {/* Filter & Sort panel */}
              <div className="w-full bg-gray-800 rounded-lg shadow-md border border-gray-700 overflow-hidden">
                <div className="bg-gray-700 px-4 py-2 flex justify-between items-center">
                  <h3 className="text-md font-medium text-white">
                    Filter & Sort
                  </h3>
                  <div className="flex items-center space-x-3">
                    {/* Filter icon and menu */}
                    <div className="relative" ref={filterMenuRef}>
                      <button
                        onClick={openFilterMenu}
                        className={`p-1.5 rounded-md ${
                          showFilterMenu
                            ? "bg-blue-600"
                            : "bg-gray-600 hover:bg-gray-500"
                        }`}
                        title="Filter options"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Sort icon and menu */}
                    <div className="relative" ref={sortMenuRef}>
                      <button
                        onClick={openSortMenu}
                        className={`p-1.5 rounded-md ${
                          showSortMenu
                            ? "bg-blue-600"
                            : "bg-gray-600 hover:bg-gray-500"
                        }`}
                        title="Sort options"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Reset button for both */}
                    <button
                      className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded-md"
                      onClick={() => {
                        setFilters({
                          status: "all",
                          endTime: "all",
                          timeRemaining: "all",
                        });
                        setSortConfig({ key: "none", direction: "asc" });
                        openFilterMenu();
                        openSortMenu();
                      }}
                      title="Reset all filters and sorting"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Active filters display */}
                <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-gray-400">Active filters:</span>

                  {filters.status !== "all" && (
                    <span className="bg-gray-700 px-2 py-1 rounded-full flex items-center">
                      Status:{" "}
                      {filters.status === "active" ? "Active" : "Inactive"}
                      <button
                        className="ml-1 text-gray-400 hover:text-white"
                        onClick={() => updateFilter("status", "all")}
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {filters.endTime !== "all" && (
                    <span className="bg-gray-700 px-2 py-1 rounded-full flex items-center">
                      End: {filters.endTime === "today" ? "Today" : "Tomorrow"}
                      <button
                        className="ml-1 text-gray-400 hover:text-white"
                        onClick={() => updateFilter("endTime", "all")}
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {filters.timeRemaining !== "all" && (
                    <span className="bg-gray-700 px-2 py-1 rounded-full flex items-center">
                      Time:{" "}
                      {filters.timeRemaining === "less-than-1-hour"
                        ? "< 1 Hour"
                        : "> 1 Hour"}
                      <button
                        className="ml-1 text-gray-400 hover:text-white"
                        onClick={() => updateFilter("timeRemaining", "all")}
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {sortConfig.key !== "none" && (
                    <span className="bg-gray-700 px-2 py-1 rounded-full flex items-center">
                      Sort:{" "}
                      {sortConfig.key === "status"
                        ? "Status"
                        : sortConfig.key === "timeRemaining"
                        ? "Time Remaining"
                        : sortConfig.key === "hourlyRate"
                        ? "Hourly Rate"
                        : sortConfig.key === "endTime"
                        ? "End Time"
                        : "Sessions"}{" "}
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                      <button
                        className="ml-1 text-gray-400 hover:text-white"
                        onClick={() =>
                          setSortConfig({ key: "none", direction: "asc" })
                        }
                      >
                        ×
                      </button>
                    </span>
                  )}

                  {filters.status !== "all" ||
                  filters.endTime !== "all" ||
                  filters.timeRemaining !== "all" ||
                  sortConfig.key !== "none" ? (
                    <button
                      className="text-blue-400 hover:text-blue-300 ml-auto"
                      onClick={() => {
                        setFilters({
                          status: "all",
                          endTime: "all",
                          timeRemaining: "all",
                        });
                        setSortConfig({ key: "none", direction: "asc" });
                      }}
                    >
                      Clear All
                    </button>
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
              </div>
            </div>

            {/* Custom notification area */}
            {notifications.length > 0 && (
              <div className="mt-4 space-y-2">
                {(() => {
                  const errorNotification = notifications
                    .filter((n) => n.type === "error")
                    .sort((a, b) => b.timestamp - a.timestamp)[0];

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

                  return Object.values(
                    notifications
                      .filter((n) => n.type !== "error")
                      .reduce((acc, notification) => {
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

            {errorMessage && (
              <div className="bg-red-500 text-white p-4 rounded-lg mb-6">
                <p className="font-medium">{errorMessage}</p>
                <p className="mt-2 text-sm">
                  The feature will work with local storage only until the
                  database table is created.
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
            ) : errorMessage ? (
              <div className="text-center py-10 bg-gray-800 rounded-lg">
                <p className="text-lg text-red-400">{errorMessage}</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-lg text-gray-400">No accounts found</p>
                <p className="text-sm text-gray-500 mt-2">
                  Add accounts to manage mining
                </p>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg shadow overflow-hidden w-full mx-auto border border-gray-700">
                {/* Mobile-specific two-table approach */}
                <div className="block sm:hidden pb-1 pt-2">
                  <div className="text-xs text-gray-500 text-center mb-2">
                    <span>← Swipe right to see more columns →</span>
                  </div>
                  <div className="relative dual-table-container">
                    {/* Table wrapper with horizontal scroll but allowing vertical scroll */}
                    <div className="mobile-tables-wrapper">
                      {/* Left fixed column */}
                      <div className="fixed-table-wrap">
                        <table className="w-full table-auto divide-y divide-gray-700 fixed-table">
                          <thead className="bg-gray-700 sticky-header">
                            <tr className="border-b border-gray-600">
                              <th className="px-2 py-3 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                                Account
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700">
                            {getSortedAccounts(getFilteredAccounts()).map(
                              (account, idx) => (
                                <tr
                                  key={`fixed-${account.phone_number}`}
                                  className={idx % 2 === 0 ? "" : "bg-gray-850"}
                                >
                                  <td className="px-2 py-3">
                                    <div className="text-xs font-medium text-gray-200 truncate max-w-[100px]">
                                      {account.username ||
                                        account.display_name ||
                                        account.phone_number}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-[100px]">
                                      {account.phone_number}
                                    </div>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Right scrollable columns */}
                      <div className="scrollable-table-wrap">
                        <table className="w-auto table-auto divide-y divide-gray-700 scrollable-table">
                          <thead className="bg-gray-700 sticky-header">
                            <tr className="border-b border-gray-600">
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap">
                                Mining
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap">
                                Time Left
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap">
                                Rate
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-200 uppercase tracking-wider whitespace-nowrap">
                                Sessions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700">
                            {getSortedAccounts(getFilteredAccounts()).map(
                              (account, idx) => (
                                <tr
                                  key={`scroll-${account.phone_number}`}
                                  className={idx % 2 === 0 ? "" : "bg-gray-850"}
                                >
                                  <td className="px-2 py-3 text-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        console.log(
                                          "Mining button clicked (mobile)"
                                        );
                                        startMining(account);
                                      }}
                                      className={`p-1 rounded-md text-white !pointer-events-auto !cursor-pointer ${getButtonColor(
                                        miningStatus[account.phone_number] || {
                                          isActive: false,
                                          isError: false,
                                          expiresAt: null,
                                          hourlyRatio: null,
                                          teamCount: null,
                                          miningCount: null,
                                          completedSessions: null,
                                        },
                                        timers[account.phone_number] ||
                                          "00:00:00"
                                      )}`}
                                      tabIndex={0}
                                      disabled={
                                        false
                                      } /* DIRECT FIX: Never disable mining buttons - let the API handle errors */
                                      style={{ pointerEvents: "auto" }}
                                      title={
                                        canMine(account)
                                          ? "Start mining"
                                          : "Missing credentials"
                                      }
                                    >
                                      MINE
                                    </button>
                                  </td>
                                  <td className="px-2 py-3 text-xs font-mono text-gray-200 text-center whitespace-nowrap">
                                    <TimerDisplay
                                      phoneNumber={account.phone_number}
                                      initialTime={
                                        timers[account.phone_number] ||
                                        "00:00:00"
                                      }
                                      miningStatusData={miningStatus}
                                    />
                                  </td>
                                  <td className="px-2 py-3 text-xs text-gray-200 text-center whitespace-nowrap">
                                    {miningStatus[account.phone_number]
                                      ?.isActive
                                      ? miningStatus[account.phone_number]
                                          ?.hourlyRatio
                                        ? (
                                            miningStatus[account.phone_number]
                                              ?.hourlyRatio || 0
                                          ).toFixed(4) + " π"
                                        : "-"
                                      : "-"}
                                  </td>
                                  <td className="px-2 py-3 text-xs text-gray-200 text-center whitespace-nowrap">
                                    {miningStatus[account.phone_number]
                                      ?.isActive
                                      ? miningStatus[account.phone_number]
                                          ?.completedSessions || "-"
                                      : "-"}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Regular table for non-mobile view */}
                <div className="hidden sm:block overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent relative max-w-full">
                  <table
                    className="w-full table-auto divide-y divide-gray-700 relative"
                    style={{ tableLayout: "fixed" }}
                  >
                    <colgroup>
                      <col className="w-[25%] sm:w-[20%] md:w-[15%]" />
                      {/* Account */}
                      <col className="w-[10%] sm:w-[10%]" />
                      {/* Mining */}
                      <col className="w-[20%] sm:w-[15%]" />
                      {/* Time Left */}
                      <col className="w-[15%] sm:w-[10%]" />
                      {/* Rate */}
                      <col className="w-0 md:w-[10%]" />
                      {/* Team */}
                      <col className="w-0 md:w-[15%]" />
                      {/* End Time */}
                      <col className="w-[15%] sm:w-[10%]" />
                      {/* Sessions */}
                    </colgroup>
                    <thead className="bg-gray-700 sticky top-0 z-10 sticky-header">
                      <tr className="border-b border-gray-600">
                        {/* Account column - always visible */}
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                          Account
                        </th>
                        {/* Mining column - always visible */}
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-200 uppercase tracking-wider">
                          Mining
                        </th>
                        {/* Time Remaining - visible on small screens and up */}
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-200 uppercase tracking-wider">
                          Time Left
                        </th>
                        {/* Hourly Rate - visible on all screens */}
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-200 uppercase tracking-wider">
                          Rate
                        </th>
                        {/* Team Mining - visible on medium screens and up */}
                        <th className="hidden md:table-cell px-2 py-2 text-center text-xs font-medium text-gray-200 uppercase tracking-wider">
                          Team
                        </th>
                        {/* End Time - visible on medium screens and up */}
                        <th className="hidden md:table-cell px-2 py-2 text-center text-xs font-medium text-gray-200 uppercase tracking-wider">
                          End Time
                        </th>
                        {/* Sessions - visible on small screens and up */}
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-200 uppercase tracking-wider">
                          Sessions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {getSortedAccounts(getFilteredAccounts()).map(
                        (account) => (
                          <tr
                            key={account.phone_number}
                            className="hover:bg-gray-700"
                          >
                            {/* Account column - always visible with truncation */}
                            <td className="px-2 py-2">
                              <div className="text-xs font-medium text-gray-200 truncate max-w-[100px] sm:max-w-[150px]">
                                {account.username ||
                                  account.display_name ||
                                  account.phone_number}
                              </div>
                              <div className="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-[150px]">
                                {account.phone_number}
                              </div>
                            </td>
                            {/* Mining button column - always visible */}
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log("Mining button clicked (mobile)");
                                  startMining(account);
                                }}
                                className={`p-1 rounded-md text-white !pointer-events-auto !cursor-pointer ${getButtonColor(
                                  miningStatus[account.phone_number] || {
                                    isActive: false,
                                    isError: false,
                                    expiresAt: null,
                                    hourlyRatio: null,
                                    teamCount: null,
                                    miningCount: null,
                                    completedSessions: null,
                                  },
                                  timers[account.phone_number] || "00:00:00"
                                )}`}
                                tabIndex={0}
                                disabled={
                                  false
                                } /* DIRECT FIX: Never disable mining buttons - let the API handle errors */
                                style={{ pointerEvents: "auto" }}
                                title={
                                  canMine(account)
                                    ? "Start mining"
                                    : "Missing credentials"
                                }
                              >
                                MINE
                              </button>
                            </td>
                            {/* Time Remaining - visible on all screens */}
                            <td className="px-2 py-2 text-xs font-mono text-gray-200 text-center">
                              <TimerDisplay
                                phoneNumber={account.phone_number}
                                initialTime={
                                  timers[account.phone_number] || "00:00:00"
                                }
                                miningStatusData={miningStatus}
                              />
                            </td>
                            {/* Hourly Rate - visible on all screens */}
                            <td className="px-2 py-2 text-xs text-gray-200 text-center whitespace-nowrap">
                              {miningStatus[account.phone_number]?.isActive &&
                              timers[account.phone_number] !== "00:00:00" &&
                              timers[account.phone_number] !== "??:??:??" ? (
                                miningStatus[account.phone_number]
                                  ?.hourlyRatio ? (
                                  (
                                    miningStatus[account.phone_number]
                                      ?.hourlyRatio || 0
                                  ).toFixed(4) + " π"
                                ) : (
                                  "-"
                                )
                              ) : timers[account.phone_number] ===
                                "??:??:??" ? (
                                <span
                                  className="text-yellow-500"
                                  title="Mining data from past session - click MINE to restart"
                                >
                                  {miningStatus[account.phone_number]
                                    ?.hourlyRatio
                                    ? (
                                        miningStatus[account.phone_number]
                                          ?.hourlyRatio || 0
                                      ).toFixed(4) + " π*"
                                    : "-"}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            {/* Team Mining - hidden on small screens */}
                            <td className="hidden md:table-cell px-2 py-2 text-xs text-gray-200 text-center">
                              {miningStatus[account.phone_number]?.isActive &&
                              timers[account.phone_number] !== "00:00:00" &&
                              timers[account.phone_number] !== "??:??:??" ? (
                                miningStatus[account.phone_number]?.teamCount &&
                                miningStatus[account.phone_number]
                                  ?.miningCount ? (
                                  `${
                                    miningStatus[account.phone_number]
                                      ?.teamCount
                                  } / ${
                                    miningStatus[account.phone_number]
                                      ?.miningCount
                                  }`
                                ) : (
                                  "-"
                                )
                              ) : timers[account.phone_number] ===
                                "??:??:??" ? (
                                <span
                                  className="text-yellow-500"
                                  title="Mining data from past session - click MINE to restart"
                                >
                                  {miningStatus[account.phone_number]
                                    ?.teamCount &&
                                  miningStatus[account.phone_number]
                                    ?.miningCount
                                    ? `${
                                        miningStatus[account.phone_number]
                                          ?.teamCount
                                      } / ${
                                        miningStatus[account.phone_number]
                                          ?.miningCount
                                      }*`
                                    : "-"}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            {/* End Time - hidden on small screens */}
                            <td className="hidden md:table-cell px-2 py-2 text-xs text-gray-200 text-center">
                              {miningStatus[account.phone_number]?.isActive
                                ? formatEndTime(
                                    miningStatus[account.phone_number]
                                      ?.expiresAt
                                  )
                                : "-"}
                            </td>
                            {/* Sessions - visible on all screens */}
                            <td className="px-2 py-2 text-xs text-gray-200 text-center whitespace-nowrap">
                              {miningStatus[account.phone_number]?.isActive &&
                              timers[account.phone_number] !== "00:00:00" &&
                              timers[account.phone_number] !== "??:??:??" ? (
                                miningStatus[account.phone_number]
                                  ?.completedSessions || "-"
                              ) : timers[account.phone_number] ===
                                "??:??:??" ? (
                                <span
                                  className="text-yellow-500"
                                  title="Mining data from past session - click MINE to restart"
                                >
                                  {miningStatus[account.phone_number]
                                    ?.completedSessions
                                    ? miningStatus[account.phone_number]
                                        ?.completedSessions + "*"
                                    : "-"}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Dropdown Menu - positioned near the filter button with animation */}
      {showFilterMenu && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-start justify-end p-4 modal-backdrop"
          onClick={closeFilterMenu}
        >
          {/* Filter Modal - fully isolated from any outside events */}
          <div
            ref={filterMenuRef}
            className="w-80 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50 animate-dropdown mt-20 mr-4"
            style={{ maxWidth: "95vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ... filter modal content ... */}
          </div>
        </div>
      )}

      {/* Sort Dropdown Menu - positioned near the sort button with animation */}
      {showSortMenu && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-start justify-end p-4 modal-backdrop"
          onClick={closeSortMenu}
        >
          {/* Sort Modal - fully isolated from any outside events */}
          <div
            ref={sortMenuRef}
            className="w-64 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50 animate-dropdown mt-20 mr-4"
            style={{ maxWidth: "95vw" }}
          >
            {/* ... sort modal content ... */}
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Custom scrollbar styles */
        .scrollbar-thin::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: #1f2937;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 4px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }

        /* For Firefox */
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: #4b5563 #1f2937;
        }

        /* For mobile optimization */
        @media (max-width: 640px) {
          table {
            font-size: 0.75rem;
          }

          /* Dual table layout */
          .dual-table-container {
            position: relative;
            max-height: 80vh; /* Limit height to enable vertical scrolling */
            overflow-y: auto; /* Enable vertical scrolling */
          }

          /* Table wrapper for horizontal scrolling */
          .mobile-tables-wrapper {
            display: flex;
            position: relative;
            width: 100%;
          }

          /* Fixed left table - Account column (40% width) */
          .fixed-table-wrap {
            position: sticky;
            left: 0;
            width: 40%;
            z-index: 10;
            background-color: #1f2937;
            border-right: 2px solid #4b5563;
            box-shadow: 4px 0 8px rgba(0, 0, 0, 0.3);
          }

          /* Scrollable right table - all other columns */
          .scrollable-table-wrap {
            flex: 1;
            width: 60%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          /* Enhanced sticky headers */
          .sticky-header {
            position: sticky;
            top: 0;
            z-index: 20;
            background-color: #374151;
          }

          .fixed-table .sticky-header {
            z-index: 30; /* Higher z-index for fixed table header */
          }

          /* Ensure headers have proper background and shadow */
          .sticky-header th {
            position: relative;
            background-color: #374151;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          }

          /* Add shadow to indicate scroll below header */
          .sticky-header::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: -1px;
            height: 3px;
            background: linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0.2),
              transparent
            );
            pointer-events: none;
          }

          /* Add vertical sync for both tables */
          .fixed-table tr,
          .scrollable-table tr {
            height: 60px; /* Fixed height to ensure rows align */
          }

          .scrollable-table {
            width: auto;
            min-width: 400px; /* Ensure there's enough width for all columns */
          }

          /* Ensure proper column widths in scrollable table */
          .scrollable-table th:nth-child(1) {
            /* Mining column */
            width: 60px;
          }

          .scrollable-table th:nth-child(2) {
            /* Time Left column */
            width: 100px;
          }

          .scrollable-table th:nth-child(3) {
            /* Rate column */
            width: 100px;
          }

          .scrollable-table th:nth-child(4) {
            /* Sessions column */
            width: 80px;
          }

          /* Row styling */
          .bg-gray-850 {
            background-color: #1a202c;
          }

          /* Row hover style */
          .fixed-table tbody tr:hover,
          .scrollable-table tbody tr:hover {
            background-color: #2d3748;
          }
        }

        /* Animation for dropdowns */
        @keyframes dropdown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-dropdown {
          animation: dropdown 0.2s ease-out forwards;
        }

        /* Sticky header for all viewports */
        .sticky-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background-color: #374151;
        }

        .sticky-header th {
          position: relative;
          background-color: #374151;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        /* Add shadow to indicate scroll below header */
        .sticky-header::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 3px;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.2),
            transparent
          );
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

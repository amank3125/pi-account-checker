"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import Sidebar from "../components/layout/Sidebar";
import { getAllAccounts } from "@/lib/db";
import { IconPick } from "@tabler/icons-react";
import {
  getAllMiningDataSupabase,
  saveMiningDataSupabase,
} from "@/lib/supabase";
import { Json } from "@/types/supabase";

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
  validUntil: string | null;
  hourlyRatio: number | null;
  teamCount: number | null;
  miningCount: number | null;
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

export default function MinePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [miningStatus, setMiningStatus] = useState<
    Record<string, MiningStatus>
  >({});
  const [timers, setTimers] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load accounts and mining status on initial render
  useEffect(() => {
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
              validUntil: null,
              hourlyRatio: null,
              teamCount: null,
              miningCount: null,
            };
          });

          // Then update with data from Supabase
          miningData.forEach((data) => {
            // Only use active mining data where valid_until is in the future
            const isStillActive =
              data.valid_until && new Date(data.valid_until) > new Date();

            initialStatus[data.phone_number] = {
              isActive: isStillActive,
              isError: false,
              validUntil: isStillActive ? data.valid_until : null,
              hourlyRatio: data.hourly_ratio,
              teamCount: data.team_count,
              miningCount: data.mining_count,
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
        toast.error("Failed to load accounts");
        setLoading(false);
        if (error instanceof Error) {
          setErrorMessage(error.message);
        }
      }
    };

    loadAccountsAndMiningStatus();
  }, []);

  // Update timers every second
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      const updatedTimers: Record<string, string> = {};

      Object.entries(miningStatus).forEach(([phoneNumber, status]) => {
        if (status.validUntil) {
          const validUntil = new Date(status.validUntil);
          const timeDiff = validUntil.getTime() - now.getTime();

          if (timeDiff > 0) {
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
          } else {
            // Timer expired
            updatedTimers[phoneNumber] = "00:00:00";

            // Update mining status
            setMiningStatus((prev) => ({
              ...prev,
              [phoneNumber]: {
                ...prev[phoneNumber],
                isActive: false,
                validUntil: null,
              },
            }));
          }
        } else {
          updatedTimers[phoneNumber] = "00:00:00";
        }
      });

      setTimers(updatedTimers);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [miningStatus]);

  // Function to start mining for an account
  const startMining = async (account: Account) => {
    if (!account.credentials?.access_token) {
      toast.error("No access token available for this account");
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

      const result = await response.json();

      if (result.success && result.data) {
        const miningData = result.data as MiningData;

        // Extract and format the mining data
        const validUntil = miningData.valid_until;
        const hourlyRatio = miningData.hourly_ratio;
        const teamCount = miningData.earning_team?.team_count || 0;
        const miningCount = miningData.earning_team?.mining_count || 0;
        const piBalance = miningData.pi_balance || 0;
        const completedSessionsCount = miningData.completed_sessions_count || 0;

        // Save mining data to local storage
        localStorage.setItem(
          `mining_${account.phone_number}`,
          JSON.stringify(miningData)
        );

        // Convert the mining data to a safe JSON format
        const jsonMiningData: Json = JSON.parse(JSON.stringify(miningData));

        // Save to Supabase
        try {
          await saveMiningDataSupabase(account.phone_number, {
            is_active: true,
            valid_until: validUntil,
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
            validUntil,
            hourlyRatio,
            teamCount,
            miningCount,
          },
        }));

        toast.success(
          `Mining started for ${account.username || account.phone_number}`
        );
      } else {
        // Handle error
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
            mining_response: { error: result.error || "Mining failed" },
          });
        } catch (saveError) {
          console.error("Error saving error status to Supabase:", saveError);
          // Continue with local data only
        }

        toast.error(result.error || "Failed to start mining");
      }
    } catch (error) {
      console.error("Error starting mining:", error);

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
            error: error instanceof Error ? error.message : "Mining failed",
          },
        });
      } catch (saveError) {
        console.error("Error saving error status to Supabase:", saveError);
        // Continue with local data only
      }

      toast.error("Failed to connect to mining server");
    }
  };

  // Get button color based on mining status
  const getButtonColor = (status: MiningStatus) => {
    if (status.isActive) return "bg-blue-600 hover:bg-blue-700";
    if (status.isError) return "bg-red-500 hover:bg-red-600";
    return "bg-gray-600 hover:bg-gray-700";
  };

  // Format mining end time in 12-hour format
  const formatEndTime = (validUntil: string | null) => {
    if (!validUntil) return "--:--";
    const date = new Date(validUntil);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-900">
      <Sidebar isOpen={false} onClose={() => {}} />
      <main className="flex-1 p-8">
        <Toaster position="top-right" />

        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">Pi Mining</h1>

          {errorMessage && (
            <div className="mb-6 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded">
              <p className="font-bold">Warning</p>
              <p>{errorMessage}</p>
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
                                validUntil: null,
                                hourlyRatio: null,
                                teamCount: null,
                                miningCount: null,
                              }
                            )}`}
                            disabled={
                              miningStatus[account.phone_number]?.isActive
                            }
                          >
                            <IconPick className="w-5 h-5" />
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-200">
                          {timers[account.phone_number] || "00:00:00"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                          {miningStatus[account.phone_number]?.hourlyRatio
                            ? (
                                miningStatus[account.phone_number].hourlyRatio *
                                24
                              ).toFixed(4) + " π/day"
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {miningStatus[account.phone_number]?.teamCount
                            ? `${
                                miningStatus[account.phone_number].miningCount
                              } / ${
                                miningStatus[account.phone_number].teamCount
                              }`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatEndTime(
                            miningStatus[account.phone_number]?.validUntil
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

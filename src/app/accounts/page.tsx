"use client";

import { useState, useEffect, useMemo } from "react";
import { Toaster, toast } from "react-hot-toast";
import Sidebar from "../components/layout/Sidebar";
import {
  saveAccount,
  getAllAccounts,
  removeAccount,
  getAccount,
  getCacheData,
  setCacheData,
} from "@/lib/db";
import Link from "next/link";
import {
  IconColumns,
  IconTrashX,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";

interface Account {
  phone_number: string;
  user_id: string;
  username?: string;
  name?: string;
  display_name?: string;
  balance?: number;
  mining_status?: string;
  completed_sessions?: number;
  phone_verification?: string;
  facebook_verified?: boolean;
  password_status?: boolean;
  trusted_email?: string;
  email_verified?: boolean;
  kyc_eligible?: boolean;
  kyc_status?: string;
  kyc_detailed_status?: string;
  referred_by?: string;
  device_tag?: string;
  // New mainnet balance fields
  pending_balance?: number;
  balance_ready?: number;
  total_pushed_balance?: number;
  credentials?: {
    access_token: string;
  };
}

// Function to fetch mainnet balance
async function fetchMainnetBalance(accessToken: string) {
  try {
    const response = await fetch("/api/mainnet_balance", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15.0 Safari/604.1",
        Accept: "application/json, text/plain, */*",
        Origin: "https://socialchain.app",
        Referer: "https://socialchain.app/",
        Host: "socialchain.app",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch mainnet balance: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching mainnet balance:", error);
    return null;
  }
}

export default function ManageAccounts() {
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  // State for adding new account
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // State for stored accounts
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Add column visibility state
  // Define default column visibility state
  const defaultColumnVisibility = {
    username: true,
    phone_number: true,
    balance: true,
    mining_status: true,
    completed_sessions: false,
    display_name: false,
    phone_verification: false,
    facebook_verified: false,
    password_status: false,
    trusted_email: false,
    email_verified: false,
    kyc_eligible: false,
    kyc_status: false,
    kyc_detailed_status: false,
    referred_by: false,
    // New mainnet balance fields (visible by default)
    pending_balance: true,
    balance_ready: true,
    total_pushed_balance: true,
    device_tag: true,
    actions: true,
  };

  const [columnVisibility, setColumnVisibility] = useState(() => {
    if (typeof window === "undefined") return defaultColumnVisibility;

    try {
      const savedVisibility = localStorage.getItem("columnVisibility");
      return savedVisibility
        ? { ...defaultColumnVisibility, ...JSON.parse(savedVisibility) }
        : defaultColumnVisibility;
    } catch (error) {
      console.error(
        "Error parsing column visibility from localStorage:",
        error
      );
      return defaultColumnVisibility;
    }
  });

  // Handle sorting when a header is clicked
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column is clicked
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  // Save sort state to localStorage when it changes
  useEffect(() => {
    // Load sort state on component mount
    const savedSortColumn = localStorage.getItem("sortColumn");
    const savedSortDirection = localStorage.getItem("sortDirection");

    if (savedSortColumn) {
      setSortColumn(savedSortColumn);
    }
    if (savedSortDirection === "asc" || savedSortDirection === "desc") {
      setSortDirection(savedSortDirection as "asc" | "desc");
    }

    // No need to return cleanup function
  }, []);

  // Add this effect to save sort state when it changes
  useEffect(() => {
    if (sortColumn) {
      localStorage.setItem("sortColumn", sortColumn);
    } else {
      localStorage.removeItem("sortColumn");
    }
    localStorage.setItem("sortDirection", sortDirection);
  }, [sortColumn, sortDirection]);

  // Compute sorted accounts based on sort state
  const sortedAccounts = useMemo(() => {
    if (!sortColumn) return accounts;

    return [...accounts].sort((a, b) => {
      // Handle specific columns as per requirements

      // Sort Mining Status - Active or Inactive
      if (sortColumn === "mining_status") {
        const aStatus = (a.mining_status || "").toLowerCase();
        const bStatus = (b.mining_status || "").toLowerCase();
        return sortDirection === "asc"
          ? aStatus.localeCompare(bStatus)
          : bStatus.localeCompare(aStatus);
      }

      if (sortColumn === "username") {
        const aUsername = (a.username || "").toLowerCase();
        const bUsername = (b.username || "").toLowerCase();
        return sortDirection === "asc"
          ? aUsername.localeCompare(bUsername)
          : bUsername.localeCompare(aUsername);
      }

      if (sortColumn === "balance") {
        const aBalance = a.balance || 0;
        const bBalance = b.balance || 0;
        return sortDirection === "asc"
          ? aBalance - bBalance
          : bBalance - aBalance;
      }

      if (sortColumn === "completed_sessions") {
        const aSessions = a.completed_sessions || 0;
        const bSessions = b.completed_sessions || 0;
        return sortDirection === "asc"
          ? aSessions - bSessions
          : bSessions - aSessions;
      }

      if (sortColumn === "kyc_status") {
        const aStatus = (a.kyc_status || "").toLowerCase();
        const bStatus = (b.kyc_status || "").toLowerCase();
        return sortDirection === "asc"
          ? aStatus.localeCompare(bStatus)
          : bStatus.localeCompare(aStatus);
      }

      // Add sorting for new mainnet balance fields
      if (sortColumn === "pending_balance") {
        const aValue = a.pending_balance || 0;
        const bValue = b.pending_balance || 0;
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      if (sortColumn === "balance_ready") {
        const aValue = a.balance_ready || 0;
        const bValue = b.balance_ready || 0;
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      if (sortColumn === "total_pushed_balance") {
        const aValue = a.total_pushed_balance || 0;
        const bValue = b.total_pushed_balance || 0;
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Default case for other columns
      const aValue = a[sortColumn as keyof Account];
      const bValue = b[sortColumn as keyof Account];

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return sortDirection === "asc" ? -1 : 1;
      if (bValue === undefined) return sortDirection === "asc" ? 1 : -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      } else {
        const aString = String(aValue).toLowerCase();
        const bString = String(bValue).toLowerCase();
        return sortDirection === "asc"
          ? aString.localeCompare(bString)
          : bString.localeCompare(aString);
      }
    });
  }, [accounts, sortColumn, sortDirection]);

  // Save column visibility to localStorage
  useEffect(() => {
    localStorage.setItem("columnVisibility", JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const dropdown = document.getElementById("column-dropdown");
      if (dropdown && !dropdown.contains(event.target as Node)) {
        dropdown.classList.add("hidden");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // State for step indicators
  const [loginStep, setLoginStep] = useState("idle");
  // 'idle', 'checking', 'check-success', 'check-failed',
  // 'obtaining', 'obtain-success', 'obtain-failed'
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);

  // New: open/close sidebar on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Reset login step after success
  useEffect(() => {
    if (loginStep === "obtain-success") {
      const timer = setTimeout(() => {
        setLoginStep("idle");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loginStep]);

  // Load accounts from IndexedDB with Pi data
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const savedAccounts = await getAllAccounts();
        console.log("Saved accounts:", savedAccounts);

        // Force refresh mainnet balances for all accounts
        for (const account of savedAccounts) {
          if (account.credentials?.access_token) {
            try {
              console.log(
                `Refreshing mainnet balance for ${account.phone_number}`
              );
              const mainnetBalance = await fetchMainnetBalance(
                account.credentials.access_token
              );
              if (mainnetBalance) {
                console.log(
                  `Got fresh mainnet balance for ${account.phone_number}:`,
                  mainnetBalance
                );
                await setCacheData(
                  account.phone_number,
                  "mainnet",
                  mainnetBalance
                );
              }
            } catch (err) {
              console.error(
                `Failed to refresh mainnet balance for ${account.phone_number}:`,
                err
              );
            }
          }
        }

        const accountsWithData = await Promise.all(
          savedAccounts.map(async (account) => {
            const userData = await getCacheData(account.phone_number, "user");
            console.log(`User data for ${account.phone_number}:`, userData);

            const piData = await getCacheData(account.phone_number, "pi");
            let username = account.username;
            let balance = 0;
            let mining_status = "Inactive";

            // Start with display_name from the account record first
            let display_name = account.display_name || "";
            console.log(
              `Initial display_name for ${account.phone_number}:`,
              display_name
            );

            let phone_verification = "";
            let facebook_verified = false;
            let password_status = false;
            let trusted_email = "";
            let email_verified = false;
            let kyc_eligible = false;
            let referred_by = "";
            let completed_sessions = 0;
            let kyc_status = "";
            let kyc_detailed_status = "";

            // Initialize mainnet balance values
            let pending_balance = 0;
            let balance_ready = 0;
            let total_pushed_balance = 0;

            if (userData && typeof userData === "object") {
              // Log the structure of userData to debug
              console.log(
                `User data structure for ${account.phone_number}:`,
                JSON.stringify(userData, null, 2)
              );

              const userDataObj = userData as {
                profile?: {
                  username?: string;
                  name?: string;
                  display_name?: string;
                  phone_verification?: string;
                  verified_with_facebook?: boolean;
                  password_status?: { exists: boolean };
                  trusted_email?: string;
                  email_verified?: boolean;
                  kyc_eligible?: boolean;
                };
                referring_user?: {
                  display_name?: string;
                };
              };

              username = userDataObj.profile?.username || "";

              // If we don't have a display_name, try to get it from the profile
              if (!display_name) {
                // Try both name and display_name fields
                display_name =
                  userDataObj.profile?.name ||
                  userDataObj.profile?.display_name ||
                  "";
                console.log(
                  `Updated display_name for ${account.phone_number} from user data:`,
                  display_name
                );
              }
              phone_verification =
                userDataObj.profile?.phone_verification || "";
              facebook_verified =
                userDataObj.profile?.verified_with_facebook || false;
              password_status =
                userDataObj.profile?.password_status?.exists || false;
              trusted_email = userDataObj.profile?.trusted_email || "";
              email_verified = userDataObj.profile?.email_verified || false;
              kyc_eligible = userDataObj.profile?.kyc_eligible || false;
              referred_by = userDataObj.referring_user?.display_name || "";
            }

            if (piData && typeof piData === "object") {
              const piDataObj = piData as {
                balance?: number;
                mining_status?: { is_mining: boolean };
                completed_sessions_count?: number;
              };
              balance = piDataObj.balance || 0;
              mining_status = piDataObj.mining_status?.is_mining
                ? "Active"
                : "Inactive";
              completed_sessions = piDataObj.completed_sessions_count || 0;
            }

            const kycData = await getCacheData(account.phone_number, "kyc");
            if (kycData && typeof kycData === "object") {
              const kycDataObj = kycData as {
                status?: string;
                detailed_status?: string;
              };
              kyc_status = kycDataObj.status || "";
              kyc_detailed_status = kycDataObj.detailed_status || "";
            }

            // Fetch mainnet balance data
            const mainnetData = await getCacheData(
              account.phone_number,
              "mainnet"
            );
            if (mainnetData && typeof mainnetData === "object") {
              const mainnetDataObj = mainnetData as {
                pending_balance?: number;
                balance_ready?: number;
                total_pushed_balance?: number;
              };

              console.log(
                `Mainnet data for ${account.phone_number}:`,
                mainnetDataObj
              );

              pending_balance = mainnetDataObj.pending_balance || 0;
              balance_ready = mainnetDataObj.balance_ready || 0;
              total_pushed_balance = mainnetDataObj.total_pushed_balance || 0;
            } else if (account.credentials?.access_token) {
              // If no cached data exists, fetch from API
              try {
                const mainnetBalance = await fetchMainnetBalance(
                  account.credentials.access_token
                );
                if (mainnetBalance) {
                  console.log(
                    `Mainnet balance data from API for ${account.phone_number}:`,
                    mainnetBalance
                  );

                  pending_balance = mainnetBalance.pending_balance || 0;
                  balance_ready = mainnetBalance.balance_ready || 0;
                  total_pushed_balance =
                    mainnetBalance.total_pushed_balance || 0;

                  // Cache the mainnet balance data
                  await setCacheData(
                    account.phone_number,
                    "mainnet",
                    mainnetBalance
                  );
                }
              } catch (err) {
                console.error("Failed to fetch mainnet balance:", err);
              }
            }

            // If no display name but we have credentials, try to refresh user data
            if (!display_name && account.credentials?.access_token) {
              try {
                console.log(
                  `Refreshing user data for ${account.phone_number} due to missing display name`
                );

                const userResponse = await fetch("/api/me", {
                  headers: {
                    Authorization: `Bearer ${account.credentials.access_token}`,
                    "Content-Type": "application/json",
                  },
                });

                if (userResponse.ok) {
                  const freshUserData = await userResponse.json();
                  console.log(
                    `Fresh user data for ${account.phone_number}:`,
                    freshUserData
                  );

                  // Cache the refreshed data
                  await setCacheData(
                    account.phone_number,
                    "user",
                    freshUserData
                  );

                  // Try to get display name from the fresh data
                  if (freshUserData.profile?.name) {
                    display_name = freshUserData.profile.name;

                    // Also update the stored account
                    const updatedAccount = {
                      ...account,
                      display_name: display_name,
                    };
                    await saveAccount(updatedAccount);

                    console.log(
                      `Updated display_name for ${account.phone_number} to:`,
                      display_name
                    );
                  }
                }
              } catch (err) {
                console.error(
                  `Failed to refresh user data for ${account.phone_number}:`,
                  err
                );
              }
            }

            console.log(`Final account object for ${account.phone_number}:`, {
              username: username || account.phone_number,
              display_name,
              balance,
              mining_status,
              completed_sessions,
              phone_verification,
              facebook_verified,
              password_status,
              trusted_email,
              email_verified,
              kyc_eligible,
              kyc_status,
              kyc_detailed_status,
              referred_by,
              // Add mainnet balance data
              pending_balance,
              balance_ready,
              total_pushed_balance,
            });

            const finalAccount = {
              ...account,
              username: username || account.phone_number,
              display_name,
              balance,
              mining_status,
              completed_sessions,
              phone_verification,
              facebook_verified,
              password_status,
              trusted_email,
              email_verified,
              kyc_eligible,
              kyc_status,
              kyc_detailed_status,
              referred_by,
              // Add mainnet balance data
              pending_balance,
              balance_ready,
              total_pushed_balance,
            };

            console.log(
              `Final account object for ${account.phone_number} with mainnet data:`,
              {
                pending_balance,
                balance_ready,
                total_pushed_balance,
              }
            );

            return finalAccount;
          })
        );
        setAccounts(accountsWithData || []);
      } catch (err) {
        console.error("Failed to load accounts:", err);
        setAccounts([]);
      }
    };
    loadAccounts();
  }, []);

  // Check for existing account on phone number change
  const handlePhoneNumberChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setPhoneNumber(value);

    if (value.length >= 10) {
      const existingAccount = await getAccount(value);
      if (existingAccount) {
        setIsExistingAccount(true);
        setError("This account is already added");
      } else {
        setIsExistingAccount(false);
        setError("");
      }
    } else {
      setIsExistingAccount(false);
      setError("");
    }
  };

  // Attempt to log in and save account
  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      setError("Please enter both phone number and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Step 1: Check if account exists
      setLoginStep("checking");
      const checkResponse = await fetch("/api/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const checkData = await checkResponse.json();

      // If account exists, proceed with login
      if (
        checkResponse.ok &&
        checkData?.continue_in_webview_ui?.path === "/signin/password"
      ) {
        setLoginStep("obtaining");

        // Step 2: Attempt login
        const loginResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone_number: phoneNumber, password }),
        });
        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
          setLoginStep("obtain-failed");
          if (loginResponse.status === 401) {
            setError("Invalid Password");
          } else if (loginResponse.status === 502) {
            setError("Gateway Error (502)");
          } else {
            setError(loginData.error || "Failed to login");
          }
          return;
        }
        setLoginStep("obtain-success");
        toast.success("Successfully logged in!");

        // Optionally store user_id
        if (loginData.user_id) {
          setCachedUserId(loginData.user_id);
        }

        // Step 2: Fetch user data to store username
        const userResponse = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${loginData.credentials.access_token}`,
            "Content-Type": "application/json",
          },
        });
        const userData = await userResponse.json();
        console.log("User data from API during account creation:", userData);
        console.log("Profile name:", userData.profile?.name);

        // Fetch mainnet balance data for the new account
        const mainnetBalance = await fetchMainnetBalance(
          loginData.credentials.access_token
        );
        if (mainnetBalance) {
          // Cache the mainnet balance data
          await setCacheData(phoneNumber, "mainnet", mainnetBalance);
        }

        // Save account to IndexedDB
        await saveAccount({
          phone_number: phoneNumber,
          user_id: loginData.user_id || cachedUserId || "",
          username: userData.profile?.username,
          display_name: userData.profile?.name,
          credentials: loginData.credentials,
        });

        // Clear form
        setPassword("");
        setPhoneNumber("");
        setCachedUserId(null);

        // Reload accounts
        const savedAccounts = await getAllAccounts();
        setAccounts(savedAccounts);
      } else {
        setLoginStep("obtain-failed");
        if (checkResponse.status === 401) {
          setError("Invalid Password");
        } else if (checkResponse.status === 502) {
          setError("Gateway Error (502)");
        } else {
          setError(checkData?.error || "Failed to login");
        }
      }
    } catch (err) {
      setLoginStep("obtain-failed");
      setError("Failed to login. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Remove an account
  const handleLogout = async (phoneNum: string) => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNum }),
      });
      // Remove from IndexedDB
      await removeAccount(phoneNum);
      setAccounts(accounts.filter((acc) => acc.phone_number !== phoneNum));
      toast.success("Account removed successfully");
    } catch (err) {
      toast.error("Failed to remove account");
      console.error(err);
    }
  };

  // Helper function to render sort icons
  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return null;
    }
    return sortDirection === "asc" ? (
      <IconChevronUp className="w-4 h-4 inline-block ml-1" />
    ) : (
      <IconChevronDown className="w-4 h-4 inline-block ml-1" />
    );
  };

  // Helper function to create sortable header cells
  const renderSortableHeader = (column: string, label: string) => {
    return (
      <th
        scope="col"
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center">
          {label}
          {renderSortIcon(column)}
        </div>
      </th>
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Mobile top bar */}
      <div className="md:hidden bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Manage Accounts</h1>
        <button onClick={() => setIsSidebarOpen(true)}>
          {/* Hamburger icon */}
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Main content area */}
      <main className="flex-1">
        <Toaster position="top-center" />

        <div className="p-8">
          <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h1 className="text-2xl font-bold text-white text-center">
                Manage Accounts
              </h1>
            </div>
            <div className="p-6">
              {/* Add New Account Form */}
              <div className="mb-6 bg-gray-50 rounded-md p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Add New Account
                </h2>
                <div className="flex flex-row md:flex-row items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    {isExistingAccount && (
                      <p className="mt-1 text-sm text-red-600">
                        This account is already added
                      </p>
                    )}
                    <input
                      type="text"
                      value={phoneNumber}
                      disabled={loading}
                      onChange={handlePhoneNumberChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-600"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading || isExistingAccount}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-600"
                      placeholder="Enter password"
                    />
                  </div>

                  <button
                    onClick={handleLogin}
                    disabled={loading || isExistingAccount}
                    className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Logging in..." : "Add Account"}
                  </button>
                </div>
                {/* Login Steps / Status */}
                {loginStep !== "idle" && (
                  <div className="mt-4 flex flex-col md:flex-row items-end gap-2">
                    {/* Checking or Found? */}
                    <div
                      className={`flex items-center space-x-2 p-2 rounded
                          ${
                            loginStep === "checking"
                              ? "bg-blue-50"
                              : loginStep === "check-success" ||
                                loginStep === "obtaining" ||
                                loginStep === "obtain-success" ||
                                loginStep === "obtain-failed"
                              ? "bg-green-50"
                              : loginStep === "check-failed"
                              ? "bg-red-50"
                              : ""
                          }
                        `}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-sm font-medium
                                ${
                                  loginStep === "check-failed"
                                    ? "text-red-700"
                                    : loginStep === "check-success" ||
                                      loginStep === "obtaining" ||
                                      loginStep === "obtain-success" ||
                                      loginStep === "obtain-failed"
                                    ? "text-green-700"
                                    : "text-blue-700"
                                }
                              `}
                          >
                            {loginStep === "checking"
                              ? "Checking Pi Account"
                              : loginStep === "check-success" ||
                                loginStep === "obtaining" ||
                                loginStep === "obtain-success" ||
                                loginStep === "obtain-failed"
                              ? "Pi Account Found"
                              : loginStep === "check-failed"
                              ? "Pi Account Not Found"
                              : "Checking Pi Account"}
                          </span>

                          {loginStep === "checking" && (
                            <svg
                              className="animate-spin h-4 w-4 text-blue-600"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          )}
                          {(loginStep === "check-success" ||
                            loginStep === "obtaining" ||
                            loginStep === "obtain-success" ||
                            loginStep === "obtain-failed") && (
                            <svg
                              className="h-4 w-4 text-green-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              ></path>
                            </svg>
                          )}
                          {loginStep === "check-failed" && (
                            <svg
                              className="h-4 w-4 text-red-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                              ></path>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Obtaining Access Token? */}
                    {(loginStep === "check-success" ||
                      loginStep === "obtaining" ||
                      loginStep === "obtain-success" ||
                      loginStep === "obtain-failed") && (
                      <div
                        className={`flex items-center space-x-2 p-2 rounded
                            ${
                              loginStep === "obtaining"
                                ? "bg-blue-50"
                                : loginStep === "obtain-success"
                                ? "bg-green-50"
                                : loginStep === "obtain-failed"
                                ? "bg-red-50"
                                : ""
                            }
                          `}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-sm font-medium
                                  ${
                                    loginStep === "obtain-failed"
                                      ? "text-red-700"
                                      : loginStep === "obtain-success"
                                      ? "text-green-700"
                                      : "text-blue-700"
                                  }
                                `}
                            >
                              {loginStep === "obtaining"
                                ? "Obtaining Access Token"
                                : loginStep === "obtain-success"
                                ? "Access Token Obtained"
                                : loginStep === "obtain-failed" &&
                                  error === "Gateway Error (502)"
                                ? "Gateway Error (502)"
                                : loginStep === "obtain-failed"
                                ? "Invalid Password"
                                : "Obtaining Access Token"}
                            </span>

                            {loginStep === "obtaining" && (
                              <svg
                                className="animate-spin h-4 w-4 text-blue-600"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            )}
                            {loginStep === "obtain-failed" &&
                              error === "Gateway Error (502)" && (
                                <button
                                  onClick={handleLogin}
                                  className="p-1 rounded-full hover:bg-gray-100"
                                >
                                  {/* Retry icon */}
                                  <svg
                                    className="h-4 w-4 text-gray-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    ></path>
                                  </svg>
                                </button>
                              )}
                            {loginStep === "obtain-success" && (
                              <svg
                                className="h-4 w-4 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M5 13l4 4L19 7"
                                ></path>
                              </svg>
                            )}
                            {loginStep === "obtain-failed" && (
                              <svg
                                className="h-4 w-4 text-red-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M6 18L18 6M6 6l12 12"
                                ></path>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Show accounts table only if there are accounts */}
              {accounts.length > 0 ? (
                <>
                  {/* Column Visibility Controls */}
                  <div className="mb-4">
                    <div className="relative">
                      <button
                        className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 text-sm flex items-center cursor-pointer"
                        onClick={() =>
                          document
                            .getElementById("column-dropdown")
                            ?.classList.toggle("hidden")
                        }
                      >
                        <IconColumns className="h-4 w-4 mr-1"></IconColumns>
                        Pick Columns
                        <svg
                          className="w-4 h-4 ml-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      <div
                        id="column-dropdown"
                        className="hidden absolute z-10 mt-1 w-64 bg-white rounded-md shadow-lg p-2 border border-gray-200 max-h-60 overflow-y-auto"
                      >
                        {Object.entries(columnVisibility).map(
                          ([column, isVisible]) => (
                            <label
                              key={column}
                              className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(isVisible)}
                                onChange={() =>
                                  setColumnVisibility((prev) => ({
                                    ...prev,
                                    [column]: !prev[column],
                                  }))
                                }
                                className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                {column
                                  .split("_")
                                  .map(
                                    (word) =>
                                      word.charAt(0).toUpperCase() +
                                      word.slice(1)
                                  )
                                  .join(" ")}
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Accounts Table */}
                  <div className="mb-6 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {columnVisibility.username &&
                            renderSortableHeader("username", "Username")}
                          {columnVisibility.display_name && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Display Name
                            </th>
                          )}
                          {columnVisibility.phone_number && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Phone Number
                            </th>
                          )}
                          {columnVisibility.phone_verification && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Phone Verification
                            </th>
                          )}
                          {columnVisibility.balance &&
                            renderSortableHeader("balance", "Balance")}
                          {columnVisibility.pending_balance &&
                            renderSortableHeader(
                              "pending_balance",
                              "Pending Balance"
                            )}
                          {columnVisibility.balance_ready &&
                            renderSortableHeader(
                              "balance_ready",
                              "Balance Ready"
                            )}
                          {columnVisibility.total_pushed_balance &&
                            renderSortableHeader(
                              "total_pushed_balance",
                              "Total Pushed Balance"
                            )}
                          {columnVisibility.mining_status &&
                            renderSortableHeader(
                              "mining_status",
                              "Mining Status"
                            )}
                          {columnVisibility.completed_sessions &&
                            renderSortableHeader(
                              "completed_sessions",
                              "Completed Sessions"
                            )}
                          {columnVisibility.facebook_verified && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Facebook Verified
                            </th>
                          )}
                          {columnVisibility.password_status && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Password Status
                            </th>
                          )}
                          {columnVisibility.trusted_email && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Trusted Email
                            </th>
                          )}
                          {columnVisibility.email_verified && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Email Verified
                            </th>
                          )}
                          {columnVisibility.kyc_eligible && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              KYC Eligible
                            </th>
                          )}
                          {columnVisibility.kyc_status &&
                            renderSortableHeader("kyc_status", "KYC Status")}
                          {columnVisibility.kyc_detailed_status && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              KYC Detailed Status
                            </th>
                          )}
                          {columnVisibility.referred_by && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Referred By
                            </th>
                          )}
                          {columnVisibility.device_tag && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Device Tag
                            </th>
                          )}
                          {columnVisibility.actions && (
                            <th
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAccounts.map((account, index) => (
                          <tr key={account.phone_number}>
                            {columnVisibility.username && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-400">
                                    {index + 1}.
                                  </span>
                                  <Link
                                    href={`/accounts/${account.phone_number}`}
                                    className="text-blue-600 hover:text-blue-800 block max-w-[120px] overflow-hidden text-ellipsis"
                                    title={
                                      account.username || account.phone_number
                                    }
                                  >
                                    {account.username || account.phone_number}
                                  </Link>
                                </div>
                              </td>
                            )}
                            {columnVisibility.display_name && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.display_name || "N/A"}
                              </td>
                            )}
                            {columnVisibility.phone_number && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.phone_number}
                              </td>
                            )}
                            {columnVisibility.phone_verification && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.phone_verification || "N/A"}
                              </td>
                            )}
                            {columnVisibility.balance && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.balance?.toFixed(4)} π
                              </td>
                            )}
                            {/* New cells for mainnet balance */}
                            {columnVisibility.pending_balance && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.pending_balance?.toFixed(4) ||
                                  "0.0000"}{" "}
                                π
                              </td>
                            )}
                            {columnVisibility.balance_ready && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.balance_ready?.toFixed(4) || "0.0000"}{" "}
                                π
                              </td>
                            )}
                            {columnVisibility.total_pushed_balance && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.total_pushed_balance?.toFixed(4) ||
                                  "0.0000"}{" "}
                                π
                              </td>
                            )}
                            {columnVisibility.mining_status && (
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    account.mining_status === "Active"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}
                                >
                                  {account.mining_status}
                                </span>
                              </td>
                            )}
                            {columnVisibility.completed_sessions && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                  {account.completed_sessions || "N/A"}
                                  {account.completed_sessions &&
                                    account.completed_sessions < 30 && (
                                      <div className="relative group">
                                        <div className="w-4 h-4 flex items-center justify-center rounded-full border-2 border-red-500 text-red-500 text-xs font-bold cursor-help">
                                          !
                                        </div>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-red-100 text-red-800 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                                          Less than 30 mining sessions. May be
                                          ineligible for KYC
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </td>
                            )}
                            {columnVisibility.facebook_verified && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.facebook_verified ? "✓" : "✗"}
                              </td>
                            )}
                            {columnVisibility.password_status && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.password_status ? "✓" : "✗"}
                              </td>
                            )}
                            {columnVisibility.trusted_email && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.trusted_email || "N/A"}
                              </td>
                            )}
                            {columnVisibility.email_verified && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.email_verified ? "Yes" : "No"}
                              </td>
                            )}
                            {columnVisibility.kyc_eligible && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.kyc_eligible ? "Yes" : "No"}
                              </td>
                            )}
                            {columnVisibility.kyc_status && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.kyc_status || "Not Available"}
                              </td>
                            )}
                            {columnVisibility.kyc_detailed_status && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.kyc_detailed_status || "Not Available"}
                              </td>
                            )}
                            {columnVisibility.referred_by && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {account.referred_by || "None"}
                              </td>
                            )}
                            {columnVisibility.device_tag && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <input
                                  type="text"
                                  value={account.device_tag || ""}
                                  onChange={async (e) => {
                                    const newTag = e.target.value;
                                    const updatedAccount = {
                                      ...account,
                                      device_tag: newTag,
                                    };
                                    await saveAccount({
                                      phone_number: updatedAccount.phone_number,
                                      user_id: updatedAccount.user_id,
                                      username: updatedAccount.username,
                                      device_tag: updatedAccount.device_tag,
                                      credentials: updatedAccount.credentials
                                        ? {
                                            access_token:
                                              updatedAccount.credentials
                                                .access_token,
                                            token_type: "Bearer",
                                            expires_in: 3600,
                                            created_at: Date.now(),
                                          }
                                        : undefined,
                                    });
                                    setAccounts(
                                      accounts.map((acc) =>
                                        acc.phone_number ===
                                        account.phone_number
                                          ? updatedAccount
                                          : acc
                                      )
                                    );
                                  }}
                                  className="border border-gray-300 rounded px-2 py-1 text-sm w-full max-w-[150px]"
                                  placeholder="Enter tag..."
                                />
                              </td>
                            )}
                            {columnVisibility.actions && (
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() =>
                                    handleLogout(account.phone_number)
                                  }
                                  className="text-red-600 hover:text-red-900 flex items-center"
                                >
                                  <IconTrashX className="w-4 h-4 mr-1" />
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    No accounts added yet. Add an account to get started.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

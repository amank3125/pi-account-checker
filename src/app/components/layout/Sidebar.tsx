"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconSearch,
  IconUsers,
  IconChevronDown,
  IconChevronRight,
  IconChevronLeft,
  IconArrowRight,
  IconPick,
  IconHome,
  IconUser,
  IconPickaxe,
  IconDatabase,
} from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { getAllAccounts, getCacheData } from "@/lib/db";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { ensureValidSession, getAllAccountsSupabase } from "@/lib/supabase";

// Define a interface that can work with both account types
interface GenericAccount {
  id?: string;
  phone_number: string;
  username?: string;
  display_name?: string;
  device_tag?: string;
  password?: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  token_created_at?: number;
  added_at?: string | number; // Support both string and number formats
}

interface AccountWithUsername extends GenericAccount {
  username?: string;
  balance?: number;
  balance_ready?: number;
  mining_status?: string;
}

interface SidebarProps {
  isOpen: boolean; // controls if sidebar is visible on mobile
  onClose: () => void; // closes sidebar on mobile
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<AccountWithUsername[]>([]);
  const [isAccountsOpen, setIsAccountsOpen] = useState(true);
  const [piPrice, setPiPrice] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true); // Default to true for server rendering
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Pi price
  useEffect(() => {
    const fetchPiPrice = async () => {
      try {
        const response = await fetch("/api/price");
        const data = await response.json();
        if (data.price) {
          setPiPrice(data.price);
        }
      } catch (error) {
        console.error("Failed to fetch Pi price:", error);
      }
    };

    fetchPiPrice();
    // Refresh price every 5 minutes
    const interval = setInterval(fetchPiPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load accounts and their data
  useEffect(() => {
    // Load accounts data on mount
    loadAccounts();

    // Create a timer that checks if we need to refresh data - once per hour
    const refreshInterval = setInterval(() => {
      const now = Date.now();
      const lastFetchTime = localStorage.getItem("lastAccountFetchTime");

      // Only refresh if it's been more than 1 hour since last fetch
      if (!lastFetchTime || now - parseInt(lastFetchTime) >= 60 * 60 * 1000) {
        console.log("Hourly refresh triggered");
        loadAccounts();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes, but only refresh if hour has passed

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  // Update the useEffect for isExpanded to run only on client
  useEffect(() => {
    // Only run on the client side
    const savedState = localStorage.getItem("sidebarExpanded");
    if (savedState === "false") {
      setIsExpanded(false);
    }
  }, []);

  const isActive = (path: string) => pathname === path;

  // Save expanded state to localStorage and trigger smooth repaint
  useEffect(() => {
    localStorage.setItem("sidebarExpanded", isExpanded.toString());
    // Force a repaint to ensure smooth transitions
    document.body.style.paddingRight = "0px";
    setTimeout(() => {
      document.body.style.paddingRight = "";
    }, 0);
  }, [isExpanded]);

  // Toggle sidebar expanded/collapsed state
  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  // Modify loadAccounts function to check timestamps and use aggressive caching
  const loadAccounts = async () => {
    setIsLoading(true);
    console.log("Loading accounts in sidebar...");

    // Check when accounts were last loaded - implement 1 hour caching
    const HOUR_IN_MS = 60 * 60 * 1000; // 1 hour in milliseconds
    const now = Date.now();
    const lastFetchTime = localStorage.getItem("lastAccountFetchTime");
    const cachedAccountsString = localStorage.getItem("cachedAccounts");

    // If we have cached data and it's less than 1 hour old, use it
    if (
      lastFetchTime &&
      cachedAccountsString &&
      now - parseInt(lastFetchTime) < HOUR_IN_MS
    ) {
      try {
        const cachedAccounts = JSON.parse(cachedAccountsString);
        if (Array.isArray(cachedAccounts) && cachedAccounts.length > 0) {
          console.log("Using cached account data (< 1 hour old)");
          setAccounts(cachedAccounts);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error("Error parsing cached accounts:", e);
      }
    }

    try {
      // Choose data source based on what's available
      let accountsData: GenericAccount[] = [];

      // Check if we have Supabase session
      const hasSupabaseSession = await ensureValidSession();

      if (hasSupabaseSession) {
        // Get accounts from Supabase
        accountsData = await getAllAccountsSupabase();
      } else {
        // Fallback to IndexedDB
        accountsData = await getAllAccounts();
      }

      if (!accountsData || accountsData.length === 0) {
        console.log("No accounts found");
        setIsLoading(false);
        return;
      }

      const accountMap = new Map<string, AccountWithUsername>();

      // Initialize account objects
      accountsData.forEach((account) => {
        accountMap.set(account.phone_number, {
          ...account,
          balance: 0,
          balance_ready: 0,
        });
      });

      // Find accounts with cached data to avoid unnecessary API calls
      const phoneNumbers = accountsData.map((a) => a.phone_number);

      // Use batch processing to minimize API calls
      if (phoneNumbers.length > 0) {
        // Process in batches to avoid overwhelming the API
        const BATCH_SIZE = 5;

        for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
          const batchPhoneNumbers = phoneNumbers.slice(i, i + BATCH_SIZE);
          const cachePromises: Promise<void>[] = [];

          // Fetch user data for this batch
          for (const phoneNumber of batchPhoneNumbers) {
            // Check if we have a recent cache for this data type before fetching
            const userCacheKey = `user_cache_${phoneNumber}`;
            const piCacheKey = `pi_cache_${phoneNumber}`;
            const mainnetCacheKey = `mainnet_cache_${phoneNumber}`;

            const userCacheTime = localStorage.getItem(`${userCacheKey}_time`);
            const piCacheTime = localStorage.getItem(`${piCacheKey}_time`);
            const mainnetCacheTime = localStorage.getItem(
              `${mainnetCacheKey}_time`
            );

            // Only fetch user data if cache is expired or doesn't exist
            if (!userCacheTime || now - parseInt(userCacheTime) > HOUR_IN_MS) {
              cachePromises.push(
                getCacheData(phoneNumber, "user")
                  .then((userData) => {
                    if (userData && typeof userData === "object") {
                      const userDataObj = userData as {
                        profile?: { username?: string };
                      };
                      const acct = accountMap.get(phoneNumber);
                      if (acct && userDataObj.profile?.username) {
                        acct.username = userDataObj.profile.username;
                      }

                      // Update the cache timestamp
                      localStorage.setItem(
                        userCacheKey,
                        JSON.stringify(userData)
                      );
                      localStorage.setItem(
                        `${userCacheKey}_time`,
                        now.toString()
                      );
                    }
                  })
                  .catch(() => {
                    /* Ignore errors */
                  })
              );
            } else {
              // Use cached user data
              try {
                const cachedUserData = localStorage.getItem(userCacheKey);
                if (cachedUserData) {
                  const userData = JSON.parse(cachedUserData);
                  if (userData && typeof userData === "object") {
                    const userDataObj = userData as {
                      profile?: { username?: string };
                    };
                    const acct = accountMap.get(phoneNumber);
                    if (acct && userDataObj.profile?.username) {
                      acct.username = userDataObj.profile.username;
                    }
                  }
                }
              } catch (e) {
                console.error("Error parsing cached user data:", e);
              }
            }

            // Only fetch PI data if cache is expired or doesn't exist
            if (!piCacheTime || now - parseInt(piCacheTime) > HOUR_IN_MS) {
              cachePromises.push(
                getCacheData(phoneNumber, "pi")
                  .then((piData) => {
                    if (piData && typeof piData === "object") {
                      const piDataObj = piData as {
                        balance?: number;
                        mining_status?: { is_mining: boolean };
                      };
                      const acct = accountMap.get(phoneNumber);
                      if (acct) {
                        acct.balance = piDataObj.balance || 0;
                        acct.mining_status = piDataObj.mining_status?.is_mining
                          ? "Active"
                          : "Inactive";
                      }

                      // Update the cache timestamp
                      localStorage.setItem(piCacheKey, JSON.stringify(piData));
                      localStorage.setItem(
                        `${piCacheKey}_time`,
                        now.toString()
                      );
                    }
                  })
                  .catch(() => {
                    /* Ignore errors */
                  })
              );
            } else {
              // Use cached PI data
              try {
                const cachedPiData = localStorage.getItem(piCacheKey);
                if (cachedPiData) {
                  const piData = JSON.parse(cachedPiData);
                  if (piData && typeof piData === "object") {
                    const piDataObj = piData as {
                      balance?: number;
                      mining_status?: { is_mining: boolean };
                    };
                    const acct = accountMap.get(phoneNumber);
                    if (acct) {
                      acct.balance = piDataObj.balance || 0;
                      acct.mining_status = piDataObj.mining_status?.is_mining
                        ? "Active"
                        : "Inactive";
                    }
                  }
                }
              } catch (e) {
                console.error("Error parsing cached pi data:", e);
              }
            }

            // Only fetch mainnet data if cache is expired or doesn't exist
            if (
              !mainnetCacheTime ||
              now - parseInt(mainnetCacheTime) > HOUR_IN_MS
            ) {
              cachePromises.push(
                getCacheData(phoneNumber, "mainnet")
                  .then((mainnetData) => {
                    if (mainnetData && typeof mainnetData === "object") {
                      const mainnetDataObj = mainnetData as {
                        balance_ready?: number;
                      };
                      const acct = accountMap.get(phoneNumber);
                      if (acct)
                        acct.balance_ready = mainnetDataObj.balance_ready || 0;

                      // Update the cache timestamp
                      localStorage.setItem(
                        mainnetCacheKey,
                        JSON.stringify(mainnetData)
                      );
                      localStorage.setItem(
                        `${mainnetCacheKey}_time`,
                        now.toString()
                      );
                    }
                  })
                  .catch(() => {
                    /* Ignore errors */
                  })
              );
            } else {
              // Use cached mainnet data
              try {
                const cachedMainnetData = localStorage.getItem(mainnetCacheKey);
                if (cachedMainnetData) {
                  const mainnetData = JSON.parse(cachedMainnetData);
                  if (mainnetData && typeof mainnetData === "object") {
                    const mainnetDataObj = mainnetData as {
                      balance_ready?: number;
                    };
                    const acct = accountMap.get(phoneNumber);
                    if (acct)
                      acct.balance_ready = mainnetDataObj.balance_ready || 0;
                  }
                }
              } catch (e) {
                console.error("Error parsing cached mainnet data:", e);
              }
            }
          }

          // Only wait for promises if there are any (avoid empty Promise.all)
          if (cachePromises.length > 0) {
            await Promise.all(cachePromises);
          }

          // Small delay between batches if we have more batches to process
          if (i + BATCH_SIZE < phoneNumbers.length) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      const accountsWithData: AccountWithUsername[] = [...accountMap.values()];

      // Sort accounts by balance (descending)
      accountsWithData.sort((a, b) => {
        const balanceA = a.balance || 0;
        const balanceB = b.balance || 0;
        return balanceB - balanceA;
      });

      // Update state with processed accounts
      setAccounts(accountsWithData);

      // Store the account data in localStorage for caching
      localStorage.setItem("cachedAccounts", JSON.stringify(accountsWithData));
      localStorage.setItem("lastAccountFetchTime", now.toString());
    } catch (error) {
      console.error("Error in loadAccounts:", error);
    }

    setIsLoading(false);
  };

  // Inside the Sidebar component, after all state declarations but before the JSX
  const navItems = [
    { path: "/", icon: IconHome, label: "Dashboard" },
    { path: "/account", icon: IconUser, label: "Account" },
    { path: "/mine", icon: IconPick, label: "Mining" },
    { path: "/accounts", icon: IconUsers, label: "Accounts" },
    // Add other items as needed
  ];

  return (
    <>
      {/* Collapsed sidebar button - use client-side only rendering with useEffect */}
      {!isExpanded && (
        <div className="fixed top-16 left-0 z-40 hidden md:flex md:items-center md:justify-center md:w-20 md:mt-4">
          <button
            onClick={toggleSidebar}
            className="bg-gray-700 text-white p-2 rounded-md hover:bg-gray-600 transition-all duration-300 w-10 h-10 flex items-center justify-center"
            aria-label="Expand sidebar"
          >
            <IconArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden bg-white shadow-lg transition-all duration-300 dark:bg-gray-900 ${
          isOpen ? "w-full" : isExpanded ? "w-64" : "w-20"
        } ${isOpen ? "" : "border-r border-gray-200 dark:border-gray-800"}`}
      >
        {/* Toggle button - visible in expanded desktop mode */}
        <div className="absolute top-5 -right-2 z-50 flex space-x-2">
          <button
            className="bg-gray-700 text-white p-2 rounded-full hover:bg-gray-600 transition-colors duration-200 shadow-md"
            onClick={toggleSidebar}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? (
              <IconChevronLeft className="w-5 h-5 text-white" />
            ) : (
              <IconChevronRight className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Header */}
        <div className="text-xl font-bold mb-6 text-center pt-6 px-2">
          {isExpanded ? (
            <span className="text-ellipsis overflow-hidden whitespace-nowrap">
              Pi Account Checker
            </span>
          ) : (
            <span className="hidden md:inline-block text-center w-full">
              Pi
            </span>
          )}
        </div>

        {/* Navigation links */}
        <nav className="mt-5 px-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive(item.path)
                  ? "bg-gray-100 text-blue-600 dark:bg-gray-700 dark:text-blue-400"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              <item.icon
                className={`mr-3 h-5 w-5 ${
                  isActive(item.path)
                    ? "text-blue-500 dark:text-blue-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              />
              {isExpanded ? (
                <span className="truncate">{item.label}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* Footer (total balance) */}
        {accounts.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gray-900 border-t border-gray-700">
            {isExpanded ? (
              <div className="flex justify-between items-center gap-1">
                <span className="text-xs md:text-sm text-gray-400">
                  Mainnet Ready:
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-xs md:text-sm font-medium whitespace-nowrap">
                    {accounts
                      .reduce((sum, acc) => sum + (acc.balance_ready || 0), 0)
                      .toFixed(2)}{" "}
                    π
                  </span>
                  {piPrice && (
                    <span className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                      <IconCurrencyDollar className="w-3 h-3 mr-0.5" />
                      {(
                        accounts.reduce(
                          (sum, acc) => sum + (acc.balance_ready || 0),
                          0
                        ) * piPrice
                      ).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center">
                <IconCurrencyDollar className="w-4 h-4 text-gray-400 mr-1" />
                <span className="text-xs font-medium">
                  {accounts
                    .reduce((sum, acc) => sum + (acc.balance_ready || 0), 0)
                    .toFixed(0)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Loading state indicator */}
        {isLoading && (
          <div className="text-center py-2 text-gray-500 text-sm">
            Loading accounts...
          </div>
        )}
      </div>

      {/* Optional semi-transparent backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-opacity-60 backdrop-blur-[4px] z-40 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}

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
} from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { getAllAccounts, StoredAccount, getCacheData } from "@/lib/db";
import { IconCurrencyDollar } from "@tabler/icons-react";

interface AccountWithUsername extends StoredAccount {
  balance: number;
  balance_ready?: number;
  username?: string;
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
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const savedState = localStorage.getItem("sidebarExpanded");
    return savedState === null || savedState === "true";
  });

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

  useEffect(() => {
    const loadAccounts = async () => {
      const savedAccounts = await getAllAccounts();
      const accountsWithUsernames = await Promise.all(
        savedAccounts.map(async (account) => {
          const userData = await getCacheData(account.phone_number, "user");
          const piData = await getCacheData(account.phone_number, "pi");
          const mainnetData = await getCacheData(
            account.phone_number,
            "mainnet"
          );

          let username = account.username;
          let balance = 0;
          let balance_ready = 0;
          let mining_status = "Inactive";

          if (!username && userData && typeof userData === "object") {
            const userDataObj = userData as {
              profile?: { username?: string; display_name?: string };
            };
            username =
              userDataObj.profile?.username ||
              userDataObj.profile?.display_name;
          }

          if (piData && typeof piData === "object") {
            const piDataObj = piData as {
              balance?: number;
              mining_status?: { is_mining: boolean };
            };
            balance = piDataObj.balance || 0;
            mining_status = piDataObj.mining_status?.is_mining
              ? "Active"
              : "Inactive";
          }

          if (mainnetData && typeof mainnetData === "object") {
            const mainnetDataObj = mainnetData as { balance_ready?: number };
            balance_ready = mainnetDataObj.balance_ready || 0;
          }

          return {
            ...account,
            username: username || account.phone_number,
            balance,
            balance_ready,
            mining_status,
          };
        })
      );
      // Sort accounts by balance (largest first) - now using balance_ready
      const sortedAccounts = [...accountsWithUsernames].sort(
        (a, b) => (b.balance_ready || 0) - (a.balance_ready || 0)
      );
      setAccounts(sortedAccounts || []);
    };

    // Initial load
    loadAccounts();

    // Set up interval to refresh data every minute
    const interval = setInterval(loadAccounts, 60000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
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

  return (
    <>
      {/* Collapsed sidebar button - only visible when sidebar is collapsed on desktop */}
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
        className={`fixed top-0 left-0 z-50 h-screen bg-gray-800 text-white transform
                    transition-all duration-500 ease-in-out overflow-hidden will-change-transform will-change-width
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}
                    md:static md:translate-x-0 md:h-screen md:sticky md:top-0
                    ${
                      isExpanded
                        ? "w-56 sm:w-60 md:w-64 min-w-[14rem]"
                        : "md:w-20"
                    }`}
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

        {/* Nav links with custom scrollbar */}
        <nav className="space-y-2 px-2 overflow-y-auto h-[calc(100vh-180px)] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full">
          {/* Navigation Links */}
          <Link
            href="/"
            className={`flex p-2 rounded-md transition-colors items-center ${
              isActive("/") ? "bg-blue-600" : "hover:bg-gray-700"
            } ${!isExpanded ? "justify-center" : ""}`}
            onClick={onClose}
            title="Checker"
          >
            <IconSearch className={`w-5 h-5 ${isExpanded ? "mr-2" : ""}`} />
            {isExpanded && (
              <span className="text-sm md:text-base">Checker</span>
            )}
          </Link>

          {/* Mining Link - Add this new section */}
          <Link
            href="/mine"
            className={`flex p-2 rounded-md transition-colors items-center ${
              isActive("/mine") ? "bg-blue-600" : "hover:bg-gray-700"
            } ${!isExpanded ? "justify-center" : ""}`}
            onClick={onClose}
            title="Mining"
          >
            <IconPick className={`w-5 h-5 ${isExpanded ? "mr-2" : ""}`} />
            {isExpanded && <span className="text-sm md:text-base">Mining</span>}
          </Link>

          <div>
            <div className="flex items-center">
              <Link
                href="/accounts"
                className={`flex-1 flex items-center p-2 rounded-md transition-colors ${
                  pathname.startsWith("/accounts")
                    ? "bg-blue-600"
                    : "hover:bg-gray-700"
                } ${!isExpanded ? "justify-center" : ""}`}
                onClick={onClose}
                title="Manage Accounts"
              >
                <IconUsers
                  className={`w-5 h-5 flex-shrink-0 ${
                    isExpanded ? "mr-2" : ""
                  }`}
                />
                {isExpanded && (
                  <span className="text-sm md:text-base truncate">
                    Manage Accounts
                    {accounts.length > 0 && isExpanded && (
                      <button
                        onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                        className="p-1 ml-8 rounded-md hover:bg-white hover:text-blue-800 flex-shrink-0"
                      >
                        {isAccountsOpen ? (
                          <IconChevronDown className="w-4 h-4" />
                        ) : (
                          <IconChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </span>
                )}
              </Link>
            </div>

            {isAccountsOpen && accounts.length > 0 && isExpanded && (
              <div className="ml-2 mt-2 space-y-1 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full pr-1">
                {accounts.map((account, index) => (
                  <Link
                    key={account.phone_number}
                    href={`/accounts/${account.phone_number}`}
                    className={`block p-1.5 rounded-md text-xs transition-colors ${
                      pathname === `/accounts/${account.phone_number}`
                        ? "bg-blue-600"
                        : "hover:bg-gray-700"
                    }`}
                    onClick={onClose}
                  >
                    <div className="flex justify-between items-center gap-1 w-full">
                      <div className="flex items-center min-w-0 flex-shrink">
                        <span className="text-gray-400 mr-1 flex-shrink-0">
                          {index + 1}.
                        </span>
                        <span className="truncate">
                          {account.username || account.phone_number}
                        </span>
                      </div>
                      {account.balance_ready !== undefined && (
                        <span className="flex-shrink-0 opacity-75 text-xs whitespace-nowrap">
                          {account.balance_ready?.toFixed(2)} π
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
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

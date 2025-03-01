'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconSearch, IconUsers, IconChevronDown, IconChevronRight, IconChevronLeft } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { getAllAccounts, StoredAccount, getCacheData } from '@/lib/db';

interface AccountWithUsername extends StoredAccount {
  balance: number;
  username?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<AccountWithUsername[]>([]);
  const [isAccountsOpen, setIsAccountsOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const loadAccounts = async () => {
      const savedAccounts = await getAllAccounts();
      const accountsWithUsernames = await Promise.all(
        savedAccounts.map(async (account) => {
          const userData = await getCacheData(account.phone_number, 'user');
          const piData = await getCacheData(account.phone_number, 'pi');
          let username = account.username; // Use stored username if available
          let balance = null;
          
          // If no stored username, try to get from cache
          if (!username && userData && typeof userData === 'object') {
            const userDataObj = userData as { profile?: { username?: string; display_name?: string } };
            username = userDataObj.profile?.username || userDataObj.profile?.display_name;
          }

          // Get balance from cache if available
          if (piData && typeof piData === 'object') {
            const piDataObj = piData as { balance?: number };
            balance = piDataObj.balance;
          }
          
          return {
            ...account,
            username: username || account.phone_number, // Fallback to phone number if no username
            balance
          };
        })
      );
      setAccounts(accountsWithUsernames || []);
    };
    loadAccounts();
  }, []);

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <div className={`h-full ${collapsed ? 'w-20' : 'w-64'} bg-gray-800 text-white fixed left-0 top-0 p-4 overflow-y-auto transition-all duration-300`}>
      {/* Sidebar collapse/expand toggle */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-4 right-[-12px] bg-gray-800 border border-gray-700 rounded-full p-1 transition-transform duration-300"
      >
        {collapsed ? (
          <IconChevronRight className="w-4 h-4" />
        ) : (
          <IconChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Header */}
      {!collapsed && (
        <div className="text-xl font-bold mb-8 text-center">
          Pi Account Checker
        </div>
      )}

      <nav className="space-y-2">
        {/* Checker Link */}
        <Link
          href="/"
          className={`block p-3 rounded-md transition-colors ${isActive('/') ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
        >
          <IconSearch className="w-4 h-4 inline-block mr-2" />
          {!collapsed && 'Checker'}
        </Link>

        {/* Manage Accounts Link */}
        <div>
          <div className="flex items-center">
            <Link
              href="/accounts"
              className={`flex-1 flex items-center p-3 rounded-md transition-colors ${
                pathname.startsWith('/accounts') ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <IconUsers className="w-4 h-4 inline-block mr-2" />
              {!collapsed && 'Manage Accounts'}
            </Link>
            {/* Toggle for account list (only shown when sidebar is expanded) */}
            {!collapsed && accounts.length > 0 && (
              <button
                onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                className="p-2 ml-1 rounded-md hover:bg-gray-700"
              >
                {isAccountsOpen ? (
                  <IconChevronDown className="w-4 h-4" />
                ) : (
                  <IconChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          
          {/* Account list */}
          {!collapsed && isAccountsOpen && accounts.length > 0 && (
            <div className="ml-6 mt-2 space-y-1">
              {accounts.map((account, index) => (
                <Link
                  key={account.phone_number}
                  href={`/accounts/${account.phone_number}`}
                  className={`block p-2 rounded-md text-sm transition-colors ${
                    pathname === `/accounts/${account.phone_number}` 
                      ? 'bg-blue-600' 
                      : 'hover:bg-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>
                      <span className="text-gray-400 mr-2">{index + 1}.</span>
                      {account.username || account.phone_number}
                    </span>
                    {account.balance !== null && (
                      <span className="text-xs opacity-75">{account.balance?.toFixed(4)} π</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Total Balance (only shown when sidebar is expanded) */}
      {!collapsed && accounts.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Total Balance:</span>
            <span className="text-sm font-medium">
              {accounts.reduce((sum, account) => sum + (account.balance || 0), 0).toFixed(4)} π
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
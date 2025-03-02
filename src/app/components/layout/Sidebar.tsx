'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconSearch, IconUsers, IconChevronDown, IconChevronRight, IconChevronLeft } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { getAllAccounts, StoredAccount, getCacheData } from '@/lib/db';
import { IconCurrencyDollar } from '@tabler/icons-react';

interface AccountWithUsername extends StoredAccount {
  balance: number;
  username?: string;
}

interface SidebarProps {
  isOpen: boolean;      // controls if sidebar is visible on mobile
  onClose: () => void;  // closes sidebar on mobile
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<AccountWithUsername[]>([]);
  const [isAccountsOpen, setIsAccountsOpen] = useState(true);
  const [piPrice, setPiPrice] = useState<number | null>(null);

  // Fetch Pi price
  useEffect(() => {
    const fetchPiPrice = async () => {
      try {
        const response = await fetch('/api/price');
        const data = await response.json();
        if (data.price) {
          setPiPrice(data.price);
        }
      } catch (error) {
        console.error('Failed to fetch Pi price:', error);
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
          const userData = await getCacheData(account.phone_number, 'user');
          const piData = await getCacheData(account.phone_number, 'pi');
          let username = account.username;
          let balance = null;

          if (!username && userData && typeof userData === 'object') {
            const userDataObj = userData as { profile?: { username?: string; display_name?: string } };
            username = userDataObj.profile?.username || userDataObj.profile?.display_name;
          }

          if (piData && typeof piData === 'object') {
            const piDataObj = piData as { balance?: number };
            balance = piDataObj.balance;
          }

          return {
            ...account,
            username: username || account.phone_number,
            balance,
          };
        })
      );
      setAccounts(accountsWithUsernames || []);
    };
    loadAccounts();
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Sidebar container with slide-in effect on mobile */}
      <div
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-gray-800 text-white transform
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:static md:translate-x-0 md:h-screen md:sticky md:top-0`}
      >
        {/* Close button (visible on mobile only) */}
        <button
          className="md:hidden absolute top-4 right-4 p-2 rounded-full bg-gray-700 hover:bg-gray-600"
          onClick={onClose}
        >
          <IconChevronLeft className="w-5 h-5 text-white" />
        </button>

        {/* Header */}
        <div className="text-xl font-bold mb-8 text-center pt-6">
          Pi Account Checker
        </div>

        {/* Nav links with custom scrollbar */}
        <nav className="space-y-2 px-4 overflow-y-auto h-[calc(100vh-180px)] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full">
          <Link
            href="/"
            className={`block p-3 rounded-md transition-colors ${
              isActive('/') ? 'bg-blue-600' : 'hover:bg-gray-700'
            }`}
            onClick={onClose}
          >
            <IconSearch className="w-4 h-4 inline-block mr-2" />
            Checker
          </Link>
          <div>
            <div className="flex items-center">
              <Link
                href="/accounts"
                className={`flex-1 flex items-center p-3 rounded-md transition-colors ${
                  pathname.startsWith('/accounts') ? 'bg-blue-600' : 'hover:bg-gray-700'
                }`}
                onClick={onClose}
              >
                <IconUsers className="w-4 h-4 inline-block mr-2" />
                Manage Accounts
              </Link>
              {accounts.length > 0 && (
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
            
            {isAccountsOpen && accounts.length > 0 && (
              <div className="ml-6 mt-2 space-y-1 overflow-y-auto max-h-[50vh] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full">
                {accounts.map((account, index) => (
                  <Link
                    key={account.phone_number}
                    href={`/accounts/${account.phone_number}`}
                    className={`block p-2 rounded-md text-sm transition-colors ${
                      pathname === `/accounts/${account.phone_number}`
                        ? 'bg-blue-600'
                        : 'hover:bg-gray-700'
                    }`}
                    onClick={onClose}
                  >
                    <div className="flex justify-between items-center">
                      <span>
                        <span className="text-gray-400 mr-2">{index + 1}.</span>
                        {account.username || account.phone_number}
                      </span>
                      {account.balance !== null && (
                        <span className="text-xs opacity-75">
                          {account.balance?.toFixed(4)} π
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
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Balance:</span>
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium">
                  {accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0).toFixed(4)} π
                </span>
                {piPrice && (
                  <span className="text-xs text-gray-500 flex items-center">
                    <IconCurrencyDollar className="w-3 h-3 mr-0.5" />
                    {(accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0) * piPrice).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optional semi-transparent backdrop on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
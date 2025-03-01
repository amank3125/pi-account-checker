'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconSearch, IconUsers, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { getAllAccounts, StoredAccount, getCacheData } from '@/lib/db';

interface AccountWithUsername extends StoredAccount {
  username?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<AccountWithUsername[]>([]);
  const [isAccountsOpen, setIsAccountsOpen] = useState(true);

  useEffect(() => {
    const loadAccounts = async () => {
      const savedAccounts = await getAllAccounts();
      const accountsWithUsernames = await Promise.all(
        savedAccounts.map(async (account) => {
          const userData = await getCacheData(account.phone_number, 'user');
          let username = account.username; // Use stored username if available
          
          // If no stored username, try to get from cache
          if (!username && userData && typeof userData === 'object') {
            const userDataObj = userData as { profile?: { username?: string; display_name?: string } };
            username = userDataObj.profile?.username || userDataObj.profile?.display_name;
          }
          
          return {
            ...account,
            username: username || account.phone_number // Fallback to phone number if no username
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
    <div className="h-full w-64 bg-gray-800 text-white fixed left-0 top-0 p-4 overflow-y-auto">
      <div className="text-xl font-bold mb-8 text-center">Pi Account Checker</div>
      <nav className="space-y-2">
        <Link
          href="/"
          className={`block p-3 rounded-md transition-colors ${isActive('/') ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
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
            <div className="ml-6 mt-2 space-y-1">
              {accounts.map((account) => (
                <Link
                  key={account.phone_number}
                  href={`/accounts/${account.phone_number}`}
                  className={`block p-2 rounded-md text-sm transition-colors ${
                    pathname === `/accounts/${account.phone_number}` 
                      ? 'bg-blue-600' 
                      : 'hover:bg-gray-700'
                  }`}
                >
                  @{account.username || account.phone_number}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
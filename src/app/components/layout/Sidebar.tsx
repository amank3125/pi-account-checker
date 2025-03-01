'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconSearch, IconUsers, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { getAllAccounts, StoredAccount } from '@/lib/db';

export default function Sidebar() {
  const pathname = usePathname();
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [isAccountsOpen, setIsAccountsOpen] = useState(true);

  useEffect(() => {
    const loadAccounts = async () => {
      const savedAccounts = await getAllAccounts();
      setAccounts(savedAccounts || []);
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
          <button
            onClick={() => setIsAccountsOpen(!isAccountsOpen)}
            className={`w-full flex items-center justify-between p-3 rounded-md transition-colors ${
              pathname.startsWith('/accounts') ? 'bg-blue-600' : 'hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center">
              <IconUsers className="w-4 h-4 inline-block mr-2" />
              Manage Accounts
            </div>
            {isAccountsOpen ? (
              <IconChevronDown className="w-4 h-4" />
            ) : (
              <IconChevronRight className="w-4 h-4" />
            )}
          </button>
          
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
                  {account.phone_number}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
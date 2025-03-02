'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconSearch, IconUsers, IconChevronDown, IconChevronRight, IconChevronLeft, IconArrowRight, IconCurrencyDollar } from '@tabler/icons-react';
import { useState, useEffect, useCallback } from 'react';
import { getAllAccounts, StoredAccount, getCacheData } from '@/lib/db';

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
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const savedState = localStorage.getItem('sidebarExpanded');
    return savedState === null || savedState === 'true';
  });

  // Update sidebar width with optimized animation
  const updateSidebarWidth = useCallback(() => {
    const sidebar = document.querySelector('[data-sidebar]');
    if (sidebar) {
      // Prevent animation on initial load or resize
      const isInitialLoad = !(sidebar as HTMLElement).style.width;
      
      if (isInitialLoad && sidebar instanceof HTMLElement) {
        sidebar.style.transitionDuration = '0ms';
      }
      
      // Apply width changes
      if (sidebar instanceof HTMLElement) {
        if (isExpanded) {
          sidebar.style.width = '256px';
          sidebar.style.minWidth = '256px'; 
          sidebar.style.maxWidth = '256px';
        } else {
          sidebar.style.width = '80px';
          sidebar.style.minWidth = '80px';
          sidebar.style.maxWidth = '80px';
        }
      }
      
      if (isInitialLoad && sidebar instanceof HTMLElement) {
        // Force a reflow to apply the initial styles without animation
        void (sidebar as HTMLElement).offsetWidth; // Access offsetWidth to trigger reflow
        sidebar.style.transitionDuration = '800ms';
      }
    }
  }, [isExpanded]);

  // Save expanded state to localStorage and update width
  useEffect(() => {
    localStorage.setItem('sidebarExpanded', isExpanded.toString());
    
    // Set width
    updateSidebarWidth();
    
    // Add resize listener
    window.addEventListener('resize', updateSidebarWidth);
    return () => window.removeEventListener('resize', updateSidebarWidth);
  }, [isExpanded, updateSidebarWidth]);

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

  // Load accounts
  useEffect(() => {
    const loadAccounts = async () => {
      const savedAccounts = await getAllAccounts();
      const accountsWithUsernames = await Promise.all(
        savedAccounts.map(async (account) => {
          const userData = await getCacheData(account.phone_number, 'user');
          const piData = await getCacheData(account.phone_number, 'pi');
          let username = account.username;
          let balance = 0;
          let mining_status = 'Inactive';
      
          if (!username && userData && typeof userData === 'object') {
            const userDataObj = userData as { profile?: { username?: string; display_name?: string } };
            username = userDataObj.profile?.username || userDataObj.profile?.display_name;
          }
      
          if (piData && typeof piData === 'object') {
            const piDataObj = piData as { balance?: number; mining_status?: { is_mining: boolean } };
            balance = piDataObj.balance || 0;
            mining_status = piDataObj.mining_status?.is_mining ? 'Active' : 'Inactive';
          }
      
          return {
            ...account,
            username: username || account.phone_number,
            balance,
            mining_status
          };
        })
      );
      setAccounts(accountsWithUsernames || []);
    };
    
    // Initial load
    loadAccounts();
    
    // Set up interval to refresh data every minute
    const interval = setInterval(loadAccounts, 60000);
    
    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => pathname === path;
  
  const toggleSidebar = () => {
    // Toggle state
    setIsExpanded(prev => !prev);
    
    // Add a class to body during animation to improve performance
    document.body.classList.add('sidebar-animating');
    
    // Remove the class after animation completes
    setTimeout(() => {
      document.body.classList.remove('sidebar-animating');
    }, 300);
  };

  return (
    <>
      {/* Collapsed sidebar button - only visible when sidebar is collapsed on desktop */}
      {!isExpanded && (
        <div className="fixed top-16 left-0 z-40 hidden md:flex md:items-center md:justify-center w-20 md:mt-4">
          <button 
            onClick={toggleSidebar}
            className="bg-gray-700 text-white p-2 rounded-md hover:bg-gray-600 transition-all duration-300 w-10 h-10 flex items-center justify-center focus:outline-none"
            aria-label="Expand sidebar"
          >
            <IconArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
      
      <div
        data-sidebar
        className={`fixed top-0 left-0 z-50 h-screen bg-gray-800 text-white
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:static md:translate-x-0 md:h-screen md:sticky md:top-0`}
        style={{
          width: isExpanded ? '256px' : '80px',
          minWidth: isExpanded ? '256px' : '80px',
          maxWidth: isExpanded ? '256px' : '80px',
          willChange: 'transform, width',
          transform: 'translateZ(0)', // Force hardware acceleration
          transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Toggle button - visible in expanded desktop mode */}
        <div className="absolute top-4 right-4 flex space-x-2">
          {/* Mobile close button */}
          <button
            className="md:hidden p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 focus:outline-none"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <IconChevronLeft className="w-5 h-5 text-white" />
          </button>
          
          {/* Desktop collapse button - only visible in expanded mode */}
          <button
            className="hidden md:flex md:items-center md:justify-center p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors duration-200 focus:outline-none"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
          >
            <IconChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>
      
        {/* Header */}
        <div className="text-xl font-bold mb-6 text-center pt-6 px-2 transition-all duration-300 ease-in-out">
          {isExpanded ? (
            <span className="text-ellipsis overflow-hidden whitespace-nowrap block w-full opacity-100 transition-opacity duration-300">Pi Account Checker</span>
          ) : (
            <span className="hidden md:block text-center w-full transition-opacity duration-300">Pi</span>
          )}
        </div>
      
        {/* Nav links with custom scrollbar */}
        <nav className="space-y-2 px-2 overflow-y-auto h-[calc(100vh-180px)] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full transition-opacity duration-300 ease-in-out">
          <Link
            href="/"
            className={`block p-2 rounded-md transition-all duration-300 flex items-center ${
              isActive('/') ? 'bg-blue-600' : 'hover:bg-gray-700'
            } ${!isExpanded ? 'justify-center' : ''}`}
            onClick={onClose}
            title="Checker"
          >
            <IconSearch className={`w-5 h-5 transition-all duration-300 ${isExpanded ? 'mr-2' : ''}`} />
            {isExpanded && <span className="text-sm md:text-base transition-opacity duration-300">Checker</span>}
          </Link>
          <div>
            <div className="flex items-center">
              <Link
                href="/accounts"
                className={`flex-1 flex items-center p-2 rounded-md transition-all duration-300 ${
                  pathname.startsWith('/accounts') ? 'bg-blue-600' : 'hover:bg-gray-700'
                } ${!isExpanded ? 'justify-center' : ''}`}
                onClick={onClose}
                title="Manage Accounts"
              >
                <IconUsers className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${isExpanded ? 'mr-2' : ''}`} />
                {isExpanded && <span className="text-sm md:text-base truncate transition-opacity duration-300">Manage Accounts</span>}
              </Link>
              {accounts.length > 0 && isExpanded && (
                <button
                  onClick={() => setIsAccountsOpen(!isAccountsOpen)}
                  className="p-1 ml-1 rounded-md hover:bg-gray-700 flex-shrink-0"
                >
                  {isAccountsOpen ? (
                    <IconChevronDown className="w-4 h-4" />
                  ) : (
                    <IconChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
            
            {isAccountsOpen && accounts.length > 0 && isExpanded && (
              <div className="ml-4 mt-2 space-y-1 overflow-y-auto max-h-[50vh] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 scrollbar-thumb-rounded-full pr-1 transition-all duration-300 ease-in-out">
                {accounts.map((account, index) => (
                  <Link
                    key={account.phone_number}
                    href={`/accounts/${account.phone_number}`}
                    className={`block p-1.5 rounded-md text-xs transition-all duration-300 ${
                      pathname === `/accounts/${account.phone_number}`
                        ? 'bg-blue-600'
                        : 'hover:bg-gray-700'
                    }`}
                    onClick={onClose}
                  >
                    <div className="flex justify-between items-center gap-1 w-full">
                      <div className="flex items-center min-w-0 flex-shrink">
                        <span className="text-gray-400 mr-1 flex-shrink-0">{index + 1}.</span>
                        <span className="truncate">{account.username || account.phone_number}</span>
                      </div>
                      {account.balance !== null && (
                        <span className="flex-shrink-0 opacity-75 text-xs whitespace-nowrap">
                          {account.balance?.toFixed(2)} π
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
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gray-900 border-t border-gray-700 transition-all duration-300 ease-in-out">
            {isExpanded ? (
              <div className="flex justify-between items-center gap-1 transition-opacity duration-300">
                <span className="text-xs md:text-sm text-gray-400">Total:</span>
                <div className="flex flex-col items-end">
                  <span className="text-xs md:text-sm font-medium whitespace-nowrap">
                    {accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0).toFixed(2)} π
                  </span>
                  {piPrice && (
                    <span className="text-xs text-gray-500 flex items-center whitespace-nowrap">
                      <IconCurrencyDollar className="w-3 h-3 mr-0.5" />
                      {(accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0) * piPrice).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center transition-opacity duration-300">
                <IconCurrencyDollar className="w-4 h-4 text-gray-400 mr-1" />
                <span className="text-xs font-medium">
                  {accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0).toFixed(0)}
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
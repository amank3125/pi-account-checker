'use client';

import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Sidebar from '../components/layout/Sidebar';
import { saveAccount, getAllAccounts, removeAccount, getAccount, getCacheData } from '@/lib/db';
import Link from 'next/link';
import { IconTrashX } from '@tabler/icons-react';

interface Account {
  phone_number: string;
  user_id: string;
  username?: string;
  credentials?: {
    access_token: string;
  };
}

export default function ManageAccounts() {
  // State for adding new account
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // State for stored accounts
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // State for step indicators
  const [loginStep, setLoginStep] = useState('idle'); 
  // 'idle', 'checking', 'check-success', 'check-failed',
  // 'obtaining', 'obtain-success', 'obtain-failed'

  const [cachedUserId, setCachedUserId] = useState<string | null>(null);

  // New: open/close sidebar on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Reset login step after success
  useEffect(() => {
    if (loginStep === 'obtain-success') {
      const timer = setTimeout(() => {
        setLoginStep('idle');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loginStep]);

  // Load accounts from IndexedDB
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const savedAccounts = await getAllAccounts();
        const accountsWithUsernames = await Promise.all(
          savedAccounts.map(async (account) => {
            const userData = await getCacheData(account.phone_number, 'user');
            if (userData && typeof userData === 'object' && 'profile' in userData) {
              const profile = (userData as { profile: { username?: string; display_name?: string } }).profile;
              return {
                ...account,
                username: profile.username || profile.display_name || account.phone_number
              };
            }
            return { ...account, username: account.phone_number };
          })
        );
        setAccounts(accountsWithUsernames || []);
      } catch (err) {
        console.error('Failed to load accounts:', err);
        setAccounts([]);
      }
    };
    loadAccounts();
  }, []);

  // Check for existing account on phone number change
  const handlePhoneNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhoneNumber(value);

    if (value.length >= 10) {
      const existingAccount = await getAccount(value);
      if (existingAccount) {
        setIsExistingAccount(true);
        setError('This account is already added');
      } else {
        setIsExistingAccount(false);
        setError('');
      }
    } else {
      setIsExistingAccount(false);
      setError('');
    }
  };

  // Attempt to log in and save account
  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      setError('Please enter both phone number and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1: Check if account exists
      setLoginStep('checking');
      const checkResponse = await fetch('/api/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const checkData = await checkResponse.json();

      // If account exists, proceed with login
      if (checkResponse.ok && checkData?.continue_in_webview_ui?.path === '/signin/password') {
        setLoginStep('obtaining');
        
        // Step 2: Attempt login
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: phoneNumber, password }),
        });
        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
          setLoginStep('obtain-failed');
          if (loginResponse.status === 401) {
            setError('Invalid Password');
          } else if (loginResponse.status === 502) {
            setError('Gateway Error (502)');
          } else {
            setError(loginData.error || 'Failed to login');
          }
          return;
        }
        setLoginStep('obtain-success');
        toast.success('Successfully logged in!');

        // Optionally store user_id
        if (loginData.user_id) {
          setCachedUserId(loginData.user_id);
        }

        // Step 2: Fetch user data to store username
        const userResponse = await fetch('/api/me', {
          headers: {
            Authorization: `Bearer ${loginData.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        const userData = await userResponse.json();

        // Save account to IndexedDB
        await saveAccount({
          phone_number: phoneNumber,
          user_id: loginData.user_id || cachedUserId || '',
          username: userData.profile?.username || userData.profile?.display_name,
          credentials: loginData.credentials,
        });

        // Clear form
        setPassword('');
        setPhoneNumber('');
        setCachedUserId(null);

        // Reload accounts
        const savedAccounts = await getAllAccounts();
        setAccounts(savedAccounts);
      } else {
        setLoginStep('obtain-failed');
        if (checkResponse.status === 401) {
          setError('Invalid Password');
        } else if (checkResponse.status === 502) {
          setError('Gateway Error (502)');
        } else {
          setError(checkData?.error || 'Failed to login');
        }
      }
    } catch (err) {
      setLoginStep('obtain-failed');
      setError('Failed to login. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Remove an account
  const handleLogout = async (phoneNum: string) => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNum }),
      });
      // Remove from IndexedDB
      await removeAccount(phoneNum);
      setAccounts(accounts.filter(acc => acc.phone_number !== phoneNum));
      toast.success('Account removed successfully');
    } catch (err) {
      toast.error('Failed to remove account');
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

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
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h1 className="text-2xl font-bold text-white text-center">
                Manage Accounts
              </h1>
            </div>
            <div className="p-6">
              {/* Add New Account */}
              <div className="mb-6 bg-gray-50 rounded-md p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Add New Account
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phoneNumber}
                      disabled={loading}
                      onChange={handlePhoneNumberChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-600"
                      placeholder="Enter phone number"
                    />
                    {isExistingAccount && (
                      <p className="mt-1 text-sm text-red-600">
                        This account is already added
                      </p>
                    )}
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
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Logging in...' : 'Add Account'}
                  </button>

                  {/* Login Steps / Status */}
                  {loginStep !== 'idle' && (
                    <div className="space-y-2 mt-4">
                      {/* Checking or Found? */}
                      <div
                        className={`flex items-center space-x-2 p-2 rounded
                          ${
                            loginStep === 'checking'
                              ? 'bg-blue-50'
                              : (loginStep === 'check-success' ||
                                loginStep === 'obtaining' ||
                                loginStep === 'obtain-success' ||
                                loginStep === 'obtain-failed')
                              ? 'bg-green-50'
                              : loginStep === 'check-failed'
                              ? 'bg-red-50'
                              : ''
                          }
                        `}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-sm font-medium
                                ${
                                  loginStep === 'check-failed'
                                    ? 'text-red-700'
                                    : (loginStep === 'check-success' ||
                                      loginStep === 'obtaining' ||
                                      loginStep === 'obtain-success' ||
                                      loginStep === 'obtain-failed')
                                    ? 'text-green-700'
                                    : 'text-blue-700'
                                }
                              `}
                            >
                              {loginStep === 'checking'
                                ? 'Checking Pi Account'
                                : (loginStep === 'check-success' ||
                                  loginStep === 'obtaining' ||
                                  loginStep === 'obtain-success' ||
                                  loginStep === 'obtain-failed')
                                ? 'Pi Account Found'
                                : loginStep === 'check-failed'
                                ? 'Pi Account Not Found'
                                : 'Checking Pi Account'}
                            </span>

                            {loginStep === 'checking' && (
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
                            {(loginStep === 'check-success' ||
                              loginStep === 'obtaining' ||
                              loginStep === 'obtain-success' ||
                              loginStep === 'obtain-failed') && (
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
                            {loginStep === 'check-failed' && (
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
                      {(loginStep === 'check-success' ||
                        loginStep === 'obtaining' ||
                        loginStep === 'obtain-success' ||
                        loginStep === 'obtain-failed') && (
                        <div
                          className={`flex items-center space-x-2 p-2 rounded
                            ${
                              loginStep === 'obtaining'
                                ? 'bg-blue-50'
                                : loginStep === 'obtain-success'
                                ? 'bg-green-50'
                                : loginStep === 'obtain-failed'
                                ? 'bg-red-50'
                                : ''
                            }
                          `}
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-sm font-medium
                                  ${
                                    loginStep === 'obtain-failed'
                                      ? 'text-red-700'
                                      : loginStep === 'obtain-success'
                                      ? 'text-green-700'
                                      : 'text-blue-700'
                                  }
                                `}
                              >
                                {loginStep === 'obtaining'
                                  ? 'Obtaining Access Token'
                                  : loginStep === 'obtain-success'
                                  ? 'Access Token Obtained'
                                  : loginStep === 'obtain-failed' &&
                                    error === 'Gateway Error (502)'
                                  ? 'Gateway Error (502)'
                                  : loginStep === 'obtain-failed'
                                  ? 'Invalid Password'
                                  : 'Obtaining Access Token'}
                              </span>

                              {loginStep === 'obtaining' && (
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
                              {loginStep === 'obtain-failed' &&
                                error === 'Gateway Error (502)' && (
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
                              {loginStep === 'obtain-success' && (
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
                              {loginStep === 'obtain-failed' && (
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
              </div>

              {/* Managed Accounts list */}
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Managed Accounts
                </h2>
                <div className="space-y-2">
                  {accounts.map((account, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-4 bg-gray-50 rounded-md"
                    >
                      <Link
                        href={`/accounts/${account.phone_number}`}
                        className="flex flex-col"
                      >
                        <span className="font-medium text-gray-800 hover:text-blue-600">
                          @{account.username}
                        </span>
                        <span className="text-[12px] text-gray-500 pl-4">
                          {account.phone_number}
                        </span>
                      </Link>
                      <button
                        onClick={() => handleLogout(account.phone_number)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                      >
                        <IconTrashX className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {accounts.length === 0 && (
                    <p className="text-gray-500 text-center py-4">
                      No accounts added yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
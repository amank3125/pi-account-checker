'use client';

import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Sidebar from '../components/layout/Sidebar';
import { saveAccount, getAllAccounts, removeAccount, getAccount } from '@/lib/db';
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
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loginStep, setLoginStep] = useState('idle'); // 'idle', 'checking', 'check-success', 'check-failed', 'obtaining', 'obtain-success', 'obtain-failed'
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (loginStep === 'obtain-success') {
      const timer = setTimeout(() => {
        setLoginStep('idle');
      }, 2000); // Hide after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [loginStep]);

  // Load accounts from IndexedDB on component mount
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const savedAccounts = await getAllAccounts();
        setAccounts(savedAccounts || []);
      } catch (error) {
        console.error('Failed to load accounts:', error);
        setAccounts([]);
      }
    };
    loadAccounts();
  }, []);

  // Handle phone number change and check for existing account
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

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      setError('Please enter both phone number and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First step: Check if account exists and perform login
      setLoginStep('checking');
      const checkResponse = await fetch('/api/check-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, password }),
      });
      const loginData = await checkResponse.json();

      if (checkResponse.ok && loginData?.credentials?.access_token) {
        setLoginStep('obtain-success');
        toast.success('Successfully logged in!');

        // Optionally update cachedUserId from loginData if available
        if (loginData.user_id) {
          setCachedUserId(loginData.user_id);
        }

        // Get user data to save username
        const userResponse = await fetch('/api/me', {
          headers: {
            'Authorization': `Bearer ${loginData.credentials.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        const userData = await userResponse.json();

        // Save account with username
        await saveAccount({
          phone_number: phoneNumber,
          user_id: loginData.user_id || cachedUserId || '',
          username: userData.profile?.username || userData.profile?.display_name,
          credentials: loginData.credentials,
        });

        setPassword('');
        setPhoneNumber('');
        setCachedUserId(null);
        // Update accounts list from IndexedDB
        const savedAccounts = await getAllAccounts();
        setAccounts(savedAccounts);
      } else {
        setLoginStep('obtain-failed');
        if (checkResponse.status === 401) {
          setError('Invalid Password');
        } else if (checkResponse.status === 502) {
          setError('Gateway Error (502)');
        } else {
          setError(loginData.error || 'Failed to login');
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

  const handleLogout = async (phoneNumber: string) => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      // Remove from IndexedDB and update state
      await removeAccount(phoneNumber);
      setAccounts(accounts.filter(acc => acc.phone_number !== phoneNumber));
      toast.success('Account removed successfully');
    } catch (err) {
      toast.error('Failed to remove account');
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Toaster position="top-center" />
        <div className="p-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h1 className="text-2xl font-bold text-white text-center">Manage Accounts</h1>
            </div>
            <div className="p-6">
              <div className="mb-6 bg-gray-50 rounded-md p-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Account</h2>
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
                  {loginStep !== 'idle' && (
                    <div className="space-y-2 mt-4">
                      <div className={`flex items-center space-x-2 p-2 rounded ${
                        loginStep === 'checking' ? 'bg-blue-50' :
                        (loginStep === 'check-success' || loginStep === 'obtaining' || loginStep === 'obtain-success' || loginStep === 'obtaining' || loginStep === 'obtain-failed') ? 'bg-green-50' :
                        loginStep === 'check-failed' ? 'bg-red-50' :
                        ''
                      }`}>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-medium ${
                              loginStep === 'check-failed' ? 'text-red-700' :
                              (loginStep === 'check-success' || loginStep === 'obtaining' || loginStep === 'obtain-success' || loginStep === 'obtain-failed') ? 'text-green-700' :
                              'text-blue-700'
                            }`}>
                              {loginStep === 'checking' ? 'Checking Pi Account' :
                               (loginStep === 'check-success' || loginStep === 'obtaining' || loginStep === 'obtain-success' || loginStep === 'obtain-failed') ? 'Pi Account Found' :
                               loginStep === 'check-failed' ? 'Pi Account Not Found' :
                               'Checking Pi Account'}
                            </span>
                            {loginStep === 'checking' && (
                              <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {(loginStep === 'check-success' || loginStep === 'obtaining' || loginStep === 'obtain-success' || loginStep === 'obtain-failed') && (
                              <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                              </svg>
                            )}
                            {loginStep === 'check-failed' && (
                              <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                     
                      {(loginStep === 'check-success' || loginStep === 'obtaining' || loginStep === 'obtain-success' || loginStep === 'obtain-failed') && (
                        <div className={`flex items-center space-x-2 p-2 rounded ${
                          loginStep === 'obtaining' ? 'bg-blue-50' :
                          loginStep === 'obtain-success' ? 'bg-green-50' :
                          loginStep === 'obtain-failed' ? 'bg-red-50' :
                          ''
                        }`}>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm font-medium ${
                                loginStep === 'obtain-failed' ? 'text-red-700' :
                                loginStep === 'obtain-success' ? 'text-green-700' :
                                'text-blue-700'
                              }`}>
                                {loginStep === 'obtaining' ? 'Obtaining Access Token' :
                                 loginStep === 'obtain-success' ? 'Access Token Obtained' :
                                 loginStep === 'obtain-failed' && error === 'Gateway Error (502)' ? 'Gateway Error (502)' :
                                 loginStep === 'obtain-failed' ? 'Invalid Password' :
                                 'Obtaining Access Token'}
                              </span>
                              {loginStep === 'obtaining' && (
                                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              )}
                              {loginStep === 'obtain-failed' && error === 'Gateway Error (502)' && (
                                <button 
                                  onClick={handleLogin}
                                  className="p-1 rounded-full hover:bg-gray-100"
                                >
                                  <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                  </svg>
                                </button>
                              )}
                              {loginStep === 'obtain-success' && (
                                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                              )}
                              {loginStep === 'obtain-failed' && (
                                <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
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
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Managed Accounts</h2>
                <div className="space-y-2">
                  {accounts.map((account, index) => (
                    <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-md">
                      <Link 
                        href={`/accounts/${account.phone_number}`}
                        className="flex font-medium text-gray-800 hover:text-blue-600"
                      >
                        {account.phone_number}
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

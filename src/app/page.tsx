'use client';

import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Sidebar from './components/layout/Sidebar';

// Define interface for the check result
interface CheckResult {
  number: string;
  isAccountFound: boolean;
  data?: any;
  error?: string;
}

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bulkNumbers, setBulkNumbers] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('single'); // 'single' or 'bulk'
  const [bulkResults, setBulkResults] = useState<CheckResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [totalChecks, setTotalChecks] = useState(0);

  const handlePhoneNumberChange = (value: string) => {
    setPhoneNumber(value);
    if (mode === 'bulk') {
      setBulkNumbers(value);
    } else if (mode === 'single' && bulkNumbers) {
      setBulkNumbers('');
    }
  };

  const checkPhoneNumber = async (number: string): Promise<CheckResult> => {
    try {
      const response = await fetch('/api/check-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: number }),
      });

      const data = await response.json();
      
      // Check either path structure - account for both formats
      const isAccountFound = data.continue_in_webview_ui?.path === '/signin/password';
      
      return {
        number,
        isAccountFound,
        data
      };
    } catch (err) {
      console.error(`Error checking ${number}:`, err);
      return {
        number,
        isAccountFound: false,
        error: err instanceof Error ? err.message : 'An unknown error occurred'
      };
    }
  };

  const handleSingleCheck = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const result = await checkPhoneNumber(phoneNumber);
      setResult(result.data);
      
      if (result.isAccountFound) {
        toast.success('Pi Account found!');
      } else {
        toast.error('No Pi account found');
      }
    } catch (err) {
      setError('Failed to check phone number. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCheck = async () => {
    if (!bulkNumbers.trim()) {
      setError('Please enter at least one phone number');
      return;
    }

    // Parse numbers (one per line)
    const numbers = bulkNumbers
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length >= 10);
    
    if (numbers.length === 0) {
      setError('No valid phone numbers found');
      return;
    }

    setLoading(true);
    setError('');
    setBulkResults([]);
    setProgress(0);
    setTotalChecks(numbers.length);
    
    toast.success(`Starting bulk check for ${numbers.length} numbers`);

    // Process each number sequentially
    const results = [];
    for (let i = 0; i < numbers.length; i++) {
      const number = numbers[i];
      const result = await checkPhoneNumber(number);
      results.push(result);
      setProgress(i + 1);
      setBulkResults(results); // Update with direct reference to results array
      
      // Short delay to prevent rate limiting
      if (i < numbers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setLoading(false);
    toast.success('Bulk check completed!');
  };

  // Check if account is found (for single mode)
  const isAccountFound = result?.continue_in_webview_ui?.path === '/signin/password';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pl-64">
        <Toaster position="top-center" />
        
        <div className="p-8">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h1 className="text-2xl font-bold text-white text-center">Pi Account Checker</h1>
            </div>

            <div className="p-6">
              {/* Mode toggle */}
              <div className="flex justify-center mb-6">
                <div className="flex border border-gray-300 rounded-md overflow-hidden">
                  <button 
                    onClick={() => setMode('single')}
                    className={`px-4 py-2 ${mode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                  >
                    Single Check
                  </button>
                  <button 
                    onClick={() => setMode('bulk')}
                    className={`px-4 py-2 ${mode === 'bulk' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                  >
                    Bulk Check
                  </button>
                </div>
              </div>

              {/* Single mode */}
              {mode === 'single' && (
                <>
                  <div className="mb-4">
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number (without country code)
                    </label>
                    <input
                      type="text"
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => handlePhoneNumberChange(e.target.value)}
                      placeholder="Enter 10 digit phone number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    />
                  </div>
                  
                  <button
                    onClick={handleSingleCheck}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
                  >
                    {loading ? 'Checking...' : 'Check Phone Number'}
                  </button>
                  
                  {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md">
                      {error}
                    </div>
                  )}
                  
                  {result && (
                    <div className={`mt-4 p-4 rounded-md ${isAccountFound ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
                      <h3 className={`text-lg font-semibold ${isAccountFound ? 'text-green-800' : 'text-red-800'}`}>
                        {isAccountFound ? 'Pi Account Found!' : 'Unregistered'}
                      </h3>
                      <p className={`mt-1 ${isAccountFound ? 'text-green-700' : 'text-red-700'}`}>
                        {isAccountFound 
                          ? `Pi account created with ${phoneNumber}` 
                          : 'No Pi Network account found for this phone number.'}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Bulk mode */}
              {mode === 'bulk' && (
                <>
                  <div className="mb-4">
                    <label htmlFor="bulkNumbers" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Numbers (one per line, without country code)
                    </label>
                    <textarea
                      id="bulkNumbers"
                      value={bulkNumbers}
                      onChange={(e) => {
                        setBulkNumbers(e.target.value);
                        if (e.target.value.includes('\n')) {
                          setPhoneNumber('');
                        } else {
                          setPhoneNumber(e.target.value);
                        }
                      }}
                      placeholder="Enter phone numbers, one per line"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                      rows={5}
                    />
                  </div>
                  
                  <button
                    onClick={handleBulkCheck}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 font-medium"
                  >
                    {loading ? `Checking... (${progress}/${totalChecks})` : 'Check All Numbers'}
                  </button>
                  
                  {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md">
                      {error}
                    </div>
                  )}
                  
                  {/* Progress bar */}
                  {loading && totalChecks > 0 && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${(progress / totalChecks) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 text-center">
                        {progress} of {totalChecks} checked
                      </p>
                    </div>
                  )}
                  
                  {/* Results table */}
                  {bulkResults.length > 0 && (
                    <div className="mt-6 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              PHONE NUMBER
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              STATUS
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {bulkResults.map((result, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-800 font-medium">
                                {result.number}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {result.error ? (
                                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    Error: {result.error}
                                  </span>
                                ) : result.isAccountFound ? (
                                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Account Found
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                    Unregistered
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
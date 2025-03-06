"use client";

import { useEffect, useState } from "react";
import { getAccount, setCacheData, getCacheData } from "@/lib/db";
import Sidebar from "../../components/layout/Sidebar";
import { useParams } from "next/navigation";
import {
  IconBrandFacebook,
  IconCheck,
  IconLogin,
  IconMail,
  IconPassword,
  IconPhone,
  IconPick,
  IconUser,
  IconWallet,
  IconX,
} from "@tabler/icons-react";

interface PiData {
  balance: number;
  completed_sessions_count: number;
  mining_status: {
    is_mining: boolean;
  };
}

interface UserData {
  profile: {
    username: string;
    name: string;
    phone_verification: string;
    verified_with_facebook: boolean;
    password_status: {
      exists: boolean;
    };
    trusted_email: string | null;
    email_verified: boolean;
    kyc_eligible: boolean;
  };
  referring_user: {
    display_name: string;
  };
}

interface KycData {
  status: string | null;
  detailed_status: string | null;
}

interface MainnetBalanceData {
  pending_balance: number;
  balance_ready: number;
  total_pushed_balance: number;
}

export default function AccountPage() {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [piData, setPiData] = useState<PiData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [kycData, setKycData] = useState<KycData | null>(null);
  const [mainnetData, setMainnetData] = useState<MainnetBalanceData | null>(
    null
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errors, setErrors] = useState({
    pi: "",
    user: "",
    kyc: "",
    mainnet: "",
  });
  useEffect(() => {
    const fetchData = async () => {
      // Try to get data from cache first
      const cachedPiData = await getCacheData(params.account as string, "pi");
      const cachedUserData = await getCacheData(
        params.account as string,
        "user"
      );
      const cachedKycData = await getCacheData(params.account as string, "kyc");
      const cachedMainnetData = await getCacheData(
        params.account as string,
        "mainnet"
      );

      if (cachedPiData) setPiData(cachedPiData as PiData);
      if (cachedUserData) setUserData(cachedUserData as UserData);
      if (cachedKycData) setKycData(cachedKycData as KycData);
      if (cachedMainnetData)
        setMainnetData(cachedMainnetData as MainnetBalanceData);
      try {
        const account = await getAccount(params.account as string);

        if (!account) {
          setErrors({
            pi: "Account not found",
            user: "Account not found",
            kyc: "Account not found",
            mainnet: "Account not found",
          });
          return;
        }

        // Get token from credentials object
        const accessToken = account.credentials.access_token;

        if (!accessToken) {
          console.error("Access token is missing from account data");
          setErrors({
            pi: "Invalid access token",
            user: "Invalid access token",
            kyc: "Invalid access token",
            mainnet: "Invalid access token",
          });
          return;
        }

        const headers = new Headers();
        headers.append("Authorization", `Bearer ${accessToken}`);
        headers.append("Content-Type", "application/json");

        // Fetch Pi data
        try {
          const piResponse = await fetch("https://socialchain.app/api/pi", {
            method: "GET",
            headers: headers,
            redirect: "follow" as RequestRedirect,
          });
          if (!piResponse.ok) {
            const errorText = await piResponse.text();
            console.error("Pi Error Response:", errorText);
            throw new Error(`Failed to fetch Pi data: ${piResponse.status}`);
          }

          const piData = await piResponse.json();
          setPiData(piData);
          // Cache the Pi data
          await setCacheData(params.account as string, "pi", piData);
        } catch (err: unknown) {
          console.error("Pi data error:", err);
          setErrors((prev) => ({ ...prev, pi: "Failed to load Pi data" }));
        }

        // Fetch User data
        try {
          const userResponse = await fetch("https://socialchain.app/api/me", {
            method: "GET",
            headers: headers,
            redirect: "follow" as RequestRedirect,
          });
          if (!userResponse.ok) {
            throw new Error(
              `Failed to fetch user data: ${userResponse.status}`
            );
          }
          const userData = await userResponse.json();
          setUserData(userData);
          // Cache the user data
          await setCacheData(params.account as string, "user", userData);
        } catch (err: unknown) {
          console.error("User data error:", err);
          setErrors((prev) => ({ ...prev, user: "Failed to load user data" }));
        }

        // Fetch KYC data
        try {
          const kycResponse = await fetch(
            "https://socialchain.app/api/kyc/pi_kyc_status",
            {
              method: "GET",
              headers: headers,
              redirect: "follow" as RequestRedirect,
            }
          );
          if (!kycResponse.ok) {
            throw new Error(`Failed to fetch KYC data: ${kycResponse.status}`);
          }
          const kycData = await kycResponse.json();
          setKycData(kycData);
          // Cache the KYC data
          await setCacheData(params.account as string, "kyc", kycData);
        } catch (err: unknown) {
          console.error("KYC data error:", err);
          setErrors((prev) => ({ ...prev, kyc: "Failed to load KYC data" }));
        }

        // Fetch Mainnet data
        try {
          const mainnetResponse = await fetch("/api/mainnet_balance", {
            method: "GET",
            headers: headers,
            redirect: "follow" as RequestRedirect,
          });
          if (!mainnetResponse.ok) {
            throw new Error(
              `Failed to fetch Mainnet data: ${mainnetResponse.status}`
            );
          }
          const mainnetData = await mainnetResponse.json();
          setMainnetData(mainnetData);
          // Cache the Mainnet data
          await setCacheData(params.account as string, "mainnet", mainnetData);
        } catch (err: unknown) {
          console.error("Mainnet data error:", err);
          setErrors((prev) => ({
            ...prev,
            mainnet: "Failed to load Mainnet data",
          }));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.account]);

  // Update retry functions similarly
  const retryPiData = async (account: unknown) => {
    try {
      const accessToken =
        (
          account as {
            credentials?: { access_token: string };
            access_token?: string;
          }
        ).credentials?.access_token ||
        (account as { access_token?: string }).access_token;
      const headers = new Headers();
      headers.append("Authorization", `Bearer ${accessToken}`);
      headers.append("Content-Type", "application/json");

      const piResponse = await fetch("https://socialchain.app/api/pi", {
        method: "GET",
        headers: headers,
        redirect: "follow" as RequestRedirect,
      });
      if (!piResponse.ok) {
        throw new Error(`Failed to fetch Pi data: ${piResponse.status}`);
      }
      const piData = await piResponse.json();
      setPiData(piData);
      setErrors((prev) => ({ ...prev, pi: "" }));
    } catch (err: unknown) {
      console.error("Pi retry error:", err);
      setErrors((prev) => ({ ...prev, pi: "Failed to load Pi data" }));
    }
  };
  const retryUserData = async (account: unknown) => {
    try {
      const accessToken =
        (
          account as {
            credentials?: { access_token: string };
            access_token?: string;
          }
        ).credentials?.access_token ||
        (account as { access_token?: string }).access_token;
      const headers = new Headers();
      headers.append("Authorization", `Bearer ${accessToken}`);
      headers.append("Content-Type", "application/json");

      const userResponse = await fetch("https://socialchain.app/api/me", {
        method: "GET",
        headers: headers,
        redirect: "follow" as RequestRedirect,
      });
      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user data: ${userResponse.status}`);
      }
      const userData = await userResponse.json();
      setUserData(userData);
      setErrors((prev) => ({ ...prev, user: "" }));
    } catch {
      setErrors((prev) => ({ ...prev, user: "Failed to load user data" }));
    }
  };
  const retryKycData = async (account: unknown) => {
    try {
      const accessToken =
        (
          account as {
            credentials?: { access_token: string };
            access_token?: string;
          }
        ).credentials?.access_token ||
        (account as { access_token?: string }).access_token;
      const headers = new Headers();
      headers.append("Authorization", `Bearer ${accessToken}`);
      headers.append("Content-Type", "application/json");

      const kycResponse = await fetch(
        "https://socialchain.app/api/kyc/pi_kyc_status",
        {
          method: "GET",
          headers: headers,
          redirect: "follow" as RequestRedirect,
        }
      );
      if (!kycResponse.ok) {
        throw new Error(`Failed to fetch KYC data: ${kycResponse.status}`);
      }
      const kycData = await kycResponse.json();
      setKycData(kycData);
      setErrors((prev) => ({ ...prev, kyc: "" }));
    } catch {
      setErrors((prev) => ({ ...prev, kyc: "Failed to load KYC data" }));
    }
  };

  // Helper components
  const Shimmer = () => (
    <div className="animate-pulse bg-gray-200 rounded h-6 w-32"></div>
  );

  const StatusIcon = ({ value }: { value: boolean }) =>
    value ? (
      <IconCheck className="h-5 w-5 text-green-500" />
    ) : (
      <IconX className="h-5 w-5 text-red-500" />
    );

  const ErrorWithRetry = ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-md">
      <span className="text-red-600">{message}</span>
      <button onClick={onRetry} className="p-1.5 hover:bg-red-100 rounded-full">
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
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  );
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Mobile top bar */}
      <div className="md:hidden bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Account Details</h1>
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

      {/* Main content with padding on md+ to accommodate sidebar */}
      <main className="flex-1 bg-white">
        <div className="p-8">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 p-4">
              <h1 className="text-2xl font-bold text-white text-center">
                Account Details
              </h1>
            </div>

            <div className="p-6 space-y-8">
              {/* Pi Mining Details */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">
                  Mining Details
                </h2>
                {errors.pi ? (
                  <ErrorWithRetry
                    message={errors.pi}
                    onRetry={async () => {
                      const account = await getAccount(
                        params.account as string
                      );
                      if (account) retryPiData(account);
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Balance
                        <IconWallet className="inline h-4 w-4 ml-1"></IconWallet>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          `${piData?.balance?.toFixed(4)} π`
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Completed Sessions
                        <IconLogin className="inline h-4 w-4 ml-1"></IconLogin>
                      </label>
                      <div className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <>
                            {piData?.completed_sessions_count}
                            {piData?.completed_sessions_count < 30 && (
                              <div className="relative group">
                                <div className="w-5 h-5 flex items-center justify-center rounded-full border-2 border-red-500 text-red-500 text-sm font-bold cursor-help">
                                  !
                                </div>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-red-100 text-red-800 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                  You&apos;ve completed less than 30 mining
                                  sessions. You might be ineligible for KYC
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Mining Status
                        <IconPick className="inline h-4 w-4 ml-1"></IconPick>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <span
                            className={`text-sm ${
                              piData?.mining_status.is_mining
                                ? "text-green-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {piData?.mining_status.is_mining
                              ? "Active"
                              : "Inactive"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mainnet Balance Section */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">
                  Mainnet Balance
                </h2>
                {errors.mainnet ? (
                  <ErrorWithRetry
                    message={errors.mainnet}
                    onRetry={async () => {
                      const account = await getAccount(
                        params.account as string
                      );
                      if (account) {
                        try {
                          const mainnetResponse = await fetch(
                            "/api/mainnet_balance",
                            {
                              headers: {
                                Authorization: `Bearer ${account.credentials.access_token}`,
                                "Content-Type": "application/json",
                              },
                            }
                          );
                          if (mainnetResponse.ok) {
                            const mainnetData = await mainnetResponse.json();
                            setMainnetData(mainnetData);
                            await setCacheData(
                              params.account as string,
                              "mainnet",
                              mainnetData
                            );
                            setErrors((prev) => ({ ...prev, mainnet: "" }));
                          } else {
                            throw new Error(
                              `Failed to fetch mainnet data: ${mainnetResponse.status}`
                            );
                          }
                        } catch (err) {
                          console.error("Error refreshing mainnet data:", err);
                          setErrors((prev) => ({
                            ...prev,
                            mainnet: "Failed to refresh mainnet data",
                          }));
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Pending Balance
                        <IconWallet className="inline h-4 w-4 ml-1"></IconWallet>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <span>
                            {mainnetData?.pending_balance?.toFixed(4) ||
                              "0.0000"}{" "}
                            π
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Balance Ready
                        <IconWallet className="inline h-4 w-4 ml-1"></IconWallet>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <span>
                            {mainnetData?.balance_ready?.toFixed(4) || "0.0000"}{" "}
                            π
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Total Pushed Balance
                        <IconWallet className="inline h-4 w-4 ml-1"></IconWallet>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <span>
                            {mainnetData?.total_pushed_balance?.toFixed(4) ||
                              "0.0000"}{" "}
                            π
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Details */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">
                  User Details
                </h2>
                {errors.user ? (
                  <ErrorWithRetry
                    message={errors.user}
                    onRetry={async () => {
                      const account = await getAccount(
                        params.account as string
                      );
                      if (account) retryUserData(account);
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Username
                        <IconUser className="inline h-4 w-4 ml-1"></IconUser>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          "@" + userData?.profile.username
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Display Name
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? <Shimmer /> : userData?.profile.name}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Phone Verification
                        <IconPhone className="inline h-4 w-4 ml-1"></IconPhone>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          userData?.profile.phone_verification
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Facebook Verified
                        <IconBrandFacebook className="inline h-4 w-4 ml-1"></IconBrandFacebook>
                      </label>
                      <div className="flex items-center space-x-2">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <StatusIcon
                            value={
                              userData?.profile.verified_with_facebook || false
                            }
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Password Status
                        <IconPassword className="inline h-4 w-4 ml-1"></IconPassword>
                      </label>
                      <div className="flex items-center space-x-2">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <StatusIcon
                            value={
                              userData?.profile.password_status.exists || false
                            }
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Trusted Email
                        <IconMail className="inline h-4 w-4 ml-1"></IconMail>
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          userData?.profile.trusted_email || "Not Set"
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Email Verified
                      </label>
                      <div className="flex items-center space-x-2">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <StatusIcon
                            value={userData?.profile.email_verified || false}
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        KYC Eligible
                      </label>
                      <div className="flex items-center space-x-2">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          <StatusIcon
                            value={userData?.profile.kyc_eligible || false}
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Referred By
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          userData?.referring_user.display_name
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* KYC Details */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">
                  KYC Status
                </h2>
                {errors.kyc ? (
                  <ErrorWithRetry
                    message={errors.kyc}
                    onRetry={async () => {
                      const account = await getAccount(
                        params.account as string
                      );
                      if (account) retryKycData(account);
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Status
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          kycData?.status || "Not Available"
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <label className="text-sm font-medium text-gray-500">
                        Detailed Status
                      </label>
                      <div className="text-lg font-medium text-gray-900">
                        {loading ? (
                          <Shimmer />
                        ) : (
                          kycData?.detailed_status || "Not Available"
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

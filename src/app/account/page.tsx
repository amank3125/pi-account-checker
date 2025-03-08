"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ensureValidSession, supabase } from "@/lib/supabase";
import Link from "next/link";

// Define a proper interface for user data
interface UserData {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
  email_verified?: boolean;
  [key: string]: any; // Allow for additional properties from Supabase
}

export default function AccountPage() {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseLinked, setSupabaseLinked] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      if (status === "loading") return;

      if (status !== "authenticated") {
        setLoading(false);
        return;
      }

      try {
        // Check Supabase connection
        const hasValidSession = await ensureValidSession();
        setSupabaseLinked(hasValidSession);

        if (hasValidSession) {
          // Get Supabase user data
          const { data: supabaseUser } = await supabase.auth.getUser();
          if (supabaseUser?.user) {
            setUserData({
              ...session.user,
              ...supabaseUser.user,
            });
          } else {
            setUserData(session.user);
          }
        } else {
          setUserData(session.user);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [session, status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-4 rounded-md dark:bg-red-900">
          <p className="text-red-800 dark:text-red-200">
            You must be signed in to view your account. Please{" "}
            <Link href="/api/auth/signin" className="font-medium underline">
              sign in
            </Link>{" "}
            to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Account Settings
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="bg-white shadow rounded-lg overflow-hidden dark:bg-gray-800">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                Your Profile
              </h3>

              <div className="flex items-center mb-6">
                {userData?.image ? (
                  <img
                    src={userData.image}
                    alt={userData.name || "User"}
                    className="h-20 w-20 rounded-full mr-4"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center mr-4">
                    <span className="text-xl text-gray-500">
                      {userData?.name?.charAt(0) || "U"}
                    </span>
                  </div>
                )}

                <div>
                  <h4 className="text-xl font-medium text-gray-900 dark:text-white">
                    {userData?.name || "User"}
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400">
                    {userData?.email || "No email provided"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Account ID:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {userData?.id || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Email Verified:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {userData?.email_verified ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Supabase Connected:
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        supabaseLinked
                          ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                          : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
                      }`}
                    >
                      {supabaseLinked ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white shadow rounded-lg overflow-hidden dark:bg-gray-800">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                Account Actions
              </h3>

              <div className="space-y-4">
                <Link
                  href="/api/auth/signout"
                  className="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Sign Out
                </Link>

                <Link
                  href="/mine"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  View Mining
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white p-4 rounded-lg shadow dark:bg-gray-800">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              About Your Account
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Your account information is synced with Google and Supabase.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can view and manage your Pi mining data through this
              application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

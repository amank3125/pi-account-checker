"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearUserData } from "@/lib/utils";

export default function SignOut() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (isSigningOut) {
      signOut({ callbackUrl: "/" });
    }
  }, [isSigningOut]);

  const handleSignOut = () => {
    clearUserData();
    setIsSigningOut(true);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">
          Sign Out
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Are you sure you want to sign out?
        </p>

        <div className="flex space-x-4 justify-center">
          <button
            onClick={handleCancel}
            className="px-6 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSignOut}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

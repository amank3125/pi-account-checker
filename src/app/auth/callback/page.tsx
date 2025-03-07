"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuthCallback() {
      // Log the current URL for debugging
      console.log("Auth callback URL:", window.location.href);

      // Process the OAuth callback
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Error in auth callback:", error);
        toast.error("Authentication failed. Please try again.");
        router.push("/");
        return;
      }

      if (data?.session) {
        console.log(
          "User authenticated successfully:",
          data.session.user.email
        );
        toast.success("Successfully connected your Google account!");

        // Redirect back to the accounts page
        router.push("/accounts");
      } else {
        console.error("No session found after OAuth callback");
        toast.error("Authentication failed. Please try again.");
        router.push("/");
      }
    }

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-xl font-semibold mb-4">
          Completing authentication...
        </h1>
        <p className="text-gray-600 mb-4">
          Please wait while we connect your account.
        </p>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

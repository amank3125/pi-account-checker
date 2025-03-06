"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import { getAllAccounts } from "@/lib/db";
import { ensureValidSession, migrateToSupabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { IconDatabase, IconDatabaseX, IconLoader } from "@tabler/icons-react";

// Google One Tap interface
interface CredentialResponse {
  credential: string;
  select_by: string;
}

interface GoogleButtonOptions {
  theme: "outline" | "filled_blue" | "filled_black";
  size: "large" | "medium" | "small";
  type: "standard" | "icon";
  shape: "rectangular" | "pill" | "circle" | "square";
  text: "signin_with" | "signup_with" | "continue_with" | "signin";
  logo_alignment: "left" | "center";
}

interface GoogleInitializeOptions {
  client_id: string;
  callback: (response: CredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleOneTapWindow extends Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: GoogleInitializeOptions) => void;
        renderButton: (
          parent: HTMLElement,
          options: GoogleButtonOptions
        ) => void;
        prompt: (notification?: object) => void;
      };
    };
  };
}

declare const window: GoogleOneTapWindow;

export default function MigrateToSupabase() {
  const { data: session, status } = useSession();
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const [migratedCount, setMigratedCount] = useState(0);
  const [isUserSynced, setIsUserSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window !== "undefined" && window.google?.accounts?.id) {
      initializeGoogleOneTap();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleOneTap;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize Google One Tap
  const initializeGoogleOneTap = useCallback(() => {
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: handleGoogleOneTapResponse,
      auto_select: true,
      cancel_on_tap_outside: false,
    });

    // Render the Google button if the div exists
    if (googleButtonRef.current) {
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        shape: "pill",
        text: "signin_with",
        logo_alignment: "left",
      });
    }
  }, []);

  // Handle Google One Tap response
  const handleGoogleOneTapResponse = async (response: CredentialResponse) => {
    try {
      setIsAuthenticating(true);

      // Exchange the Google ID token for a Supabase session
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });

      if (error) throw error;

      setIsUserSynced(true);
      setSyncError(null);
      autoSyncData();
    } catch (error) {
      console.error("Error with Google One Tap:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setSyncError(`Google authentication failed: ${errorMessage}`);
      toast.error(`Google sign-in failed: ${errorMessage}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Auto-sync with Supabase when user is authenticated
  useEffect(() => {
    const syncWithSupabase = async () => {
      if (!session?.user) return;

      try {
        // Check if we already have a Supabase session
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session) {
          console.log("Active Supabase session found, auto-syncing data");
          setIsUserSynced(true);
          setSyncError(null);
          autoSyncData();
          return;
        }

        // No Supabase session, trigger automatic Google sign-in
        console.log("No Supabase session found, initiating Google sign-in");
        setIsAuthenticating(true);

        try {
          const result = await signInWithGoogleOAuth();
          if (!result.success && result.error) {
            setSyncError(
              `Failed to auto-connect with Supabase: ${result.error}`
            );
            setSyncStatus("error");
          }
        } catch (error) {
          console.error("Error auto-connecting to Supabase:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setSyncError(`Auto-connection failed: ${errorMessage}`);
          setSyncStatus("error");
        } finally {
          setIsAuthenticating(false);
        }
      } catch (error) {
        console.error("Error during Supabase sync:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setSyncError(errorMessage);
        setSyncStatus("error");
      }
    };

    if (status === "authenticated") {
      syncWithSupabase();
    }
  }, [session, status]);

  // Define autoSyncData as a useCallback to include it in dependency array
  const autoSyncData = useCallback(async () => {
    if (syncStatus === "syncing" || !session?.user) return;

    setSyncStatus("syncing");

    try {
      // First validate session and permissions
      console.log("Validating Supabase session...");
      const isValid = await ensureValidSession();

      if (!isValid) {
        setSyncStatus("error");
        setSyncError(
          "Authentication session invalid. Please try refreshing the page."
        );
        console.error("Permission validation failed");
        return;
      }

      // Get all accounts from IndexedDB
      const accounts = await getAllAccounts();

      if (accounts.length === 0) {
        console.log("No accounts found to sync");
        setSyncStatus("success"); // Still mark as success since there's nothing to do
        setLastSyncTime(new Date());
        return;
      }

      console.log(`Starting sync for ${accounts.length} accounts...`);

      // Migrate accounts to Supabase
      const count = await migrateToSupabase(accounts);

      setMigratedCount(count);
      setSyncStatus("success");
      setLastSyncTime(new Date());
      console.log(`Successfully synced ${count} accounts with Supabase!`);
    } catch (error) {
      console.error("Error during data sync:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setSyncError(`Sync failed: ${errorMessage}`);
      setSyncStatus("error");
    }
  }, [
    session,
    syncStatus,
    setSyncStatus,
    setSyncError,
    setMigratedCount,
    setLastSyncTime,
  ]);

  const signInWithGoogleOAuth = async () => {
    try {
      setIsAuthenticating(true);

      // Try to trigger Google One Tap prompt
      if (window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
        return { success: true, error: null };
      }

      // Fallback to traditional OAuth if Google One Tap is not available
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      return { success: true, error: null };
    } catch (error) {
      console.error("Error signing in with Google:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Google sign-in failed: ${errorMessage}`);

      return { success: false, error: errorMessage };
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Manual sync trigger if automatic sync fails
  const handleManualSync = () => {
    if (syncStatus === "syncing") return;

    if (!isUserSynced) {
      signInWithGoogleOAuth();
    } else {
      autoSyncData();
    }
  };

  // Render just the database icon
  return (
    <div className="inline-block">
      {/* Hidden Google One Tap Button Container */}
      <div ref={googleButtonRef} className="hidden"></div>

      {/* DB Status Icon */}
      <div
        className="cursor-pointer"
        onClick={handleManualSync}
        title={
          syncError
            ? `Error: ${syncError}. Click to retry.`
            : syncStatus === "success"
            ? `Database in sync. Last synchronized: ${
                lastSyncTime?.toLocaleString() || "Unknown"
              }. ${migratedCount} account(s) synced.`
            : syncStatus === "syncing"
            ? "Syncing data with Supabase..."
            : "Click to sync with Supabase"
        }
      >
        {(syncStatus === "syncing" || isAuthenticating) && (
          <IconLoader
            className="h-8 w-8 ml-1 text-white bg-blue-600 rounded-full p-0.5 border-2 border-blue-400 animate-spin"
            stroke={1.5}
          />
        )}

        {syncStatus === "error" && (
          <IconDatabaseX
            className="h-8 w-8 ml-1 text-white bg-red-600 rounded-full p-0.5 border-2 border-red-400"
            stroke={1.5}
          />
        )}

        {syncStatus === "success" && (
          <IconDatabase
            className="h-8 w-8 ml-1 text-white bg-green-600 rounded-full p-0.5 border-2 border-green-400"
            stroke={1.5}
          />
        )}

        {syncStatus === "idle" && (
          <IconDatabase
            className="h-8 w-8 ml-1 text-white bg-gray-600 rounded-full p-0.5 border-2 border-gray-400"
            stroke={1.5}
          />
        )}
      </div>
    </div>
  );
}

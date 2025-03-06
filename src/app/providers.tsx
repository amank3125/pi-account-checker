"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { usePathname } from "next/navigation";
import AuthButton from "@/components/auth/AuthButton";

interface ProviderProps {
  children: ReactNode;
}

export default function Providers({ children }: ProviderProps) {
  // Get current pathname to check if on unauthorized route
  const pathname = usePathname();
  const isUnauthorizedRoute = pathname.includes("/unauthorized");

  return (
    <SessionProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#333",
            color: "#fff",
          },
          success: {
            style: {
              background: "#22c55e",
            },
          },
          error: {
            style: {
              background: "#ef4444",
            },
          },
        }}
      />

      {/* Only show auth button if NOT on unauthorized route */}
      {!isUnauthorizedRoute && (
        <div className="absolute top-0 right-0 z-50 p-3">
          <AuthButton />
        </div>
      )}

      {/* Main content */}
      {children}
    </SessionProvider>
  );
}

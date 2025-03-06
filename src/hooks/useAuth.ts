"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

type UseAuthOptions = {
  required?: boolean;
  redirectTo?: string;
  redirectIfFound?: boolean;
};

export default function useAuth(options: UseAuthOptions = {}) {
  const {
    required = false,
    redirectTo = "/auth/signin",
    redirectIfFound = false,
  } = options;

  const { data: session, status } = useSession();
  const loading = status === "loading";
  const authenticated = status === "authenticated";
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Do nothing while loading
    if (loading) return;

    // If not authenticated but authentication is required
    if (required && !authenticated) {
      router.push(
        `${redirectTo}?callbackUrl=${encodeURIComponent(pathname || "/")}`
      );
      return;
    }

    // If authenticated and we want to redirect when found (e.g., signin page)
    if (redirectIfFound && authenticated) {
      router.push("/");
      return;
    }
  }, [
    loading,
    authenticated,
    required,
    redirectTo,
    redirectIfFound,
    router,
    pathname,
  ]);

  return {
    session,
    loading,
    authenticated,
  };
}

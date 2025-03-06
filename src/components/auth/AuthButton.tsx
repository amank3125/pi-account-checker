"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  if (loading) {
    return (
      <button
        className="px-3 py-1 text-sm rounded-md bg-blue-600 text-white/70 cursor-not-allowed shadow-md"
        disabled
      >
        Loading...
      </button>
    );
  }

  if (session) {
    return (
      <div className="flex items-center space-x-3 bg-blue-600 rounded-full shadow-md px-3 py-1">
        {session.user?.image && (
          <img
            src={session.user.image}
            alt={session.user.name || "User"}
            className="w-8 h-8 rounded-full border-2 border-white"
          />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">
            {session.user?.name || "Signed in"}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-blue-100 hover:text-white text-left"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="px-4 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-md"
    >
      Sign in
    </button>
  );
}

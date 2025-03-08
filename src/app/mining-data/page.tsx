"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MiningDataRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to /mine
    router.replace("/mine");
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
      <div className="text-center">
        <p className="text-xl">Redirecting to Mining page...</p>
        <div className="mt-4 animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  );
}

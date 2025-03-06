"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

// Create a client component for the error content
function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");
  const router = useRouter();

  const errorMessages: Record<string, string> = {
    default: "An error occurred during authentication.",
    accessdenied: "Access denied. You do not have permission to sign in.",
    verification: "The verification link is invalid or has expired.",
    signin: "Try signing in with a different account.",
    oauthsignin: "Error in OAuth sign in. Please try again.",
    oauthcallback: "Error in OAuth callback. Please try again.",
    oauthcreateaccount: "Error creating an account. Please try again.",
    emailcreateaccount: "Error creating an account. Please try again.",
    callback: "Error in authentication callback. Please try again.",
    oauthaccountnotlinked:
      "This email is already associated with another account. Sign in using the original provider.",
    emailsignin: "Error sending email. Please try again.",
    credentialssignin:
      "Sign in failed. Check the details you provided are correct.",
    sessionrequired: "Please sign in to access this page.",
  };

  const errorMessage = error
    ? errorMessages[error] || errorMessages.default
    : errorMessages.default;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-3 rounded-full">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
          Authentication Error
        </h1>
        <p className="text-center text-gray-600 mb-8">{errorMessage}</p>

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go Back
          </button>
          <Link
            href="/auth/signin"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function ErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={<ErrorFallback />}>
      <ErrorContent />
    </Suspense>
  );
}

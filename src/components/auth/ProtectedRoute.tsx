"use client";

import { ReactNode } from "react";
import useAuth from "@/hooks/useAuth";
import LoadingSpinner from "../ui/LoadingSpinner";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { loading } = useAuth({ required: true });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return <>{children}</>;
}

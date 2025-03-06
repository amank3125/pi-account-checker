"use client";

import React from "react";
import {
  Shield,
  ShieldAlert,
  ShieldOff,
  Lock,
  AlertTriangle,
} from "lucide-react";

export default function UnauthorisedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-3xl w-full px-4 py-16 sm:px-6 lg:px-8 bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="relative">
          {/* Red glow effect behind the shield */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-red-500 opacity-20 rounded-full blur-3xl"></div>

          <div className="relative flex flex-col items-center">
            <div className="flex items-center justify-center w-24 h-24 bg-red-100 rounded-full mb-6">
              <ShieldAlert className="w-12 h-12 text-red-600" />
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl mb-2 text-center">
              Access Blocked
            </h1>

            <div className="flex items-center justify-center mb-6">
              <Lock className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-lg text-red-600 font-medium">
                Unauthorized Access Detected
              </p>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 mb-8 w-full">
              <div className="flex items-start mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-gray-900">
                    Firewall Protection Active
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Your access to this resource has been blocked by our
                    security system. This may be due to suspicious activity or
                    insufficient permissions.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <div className="flex items-center p-3 bg-gray-100 rounded-lg flex-1">
                  <Shield className="w-5 h-5 text-gray-500 mr-2" />
                  <div>
                    <p className="text-xs text-gray-500">Security Status</p>
                    <p className="text-sm font-medium text-gray-900">
                      Active Protection
                    </p>
                  </div>
                </div>

                <div className="flex items-center p-3 bg-gray-100 rounded-lg flex-1">
                  <ShieldOff className="w-5 h-5 text-gray-500 mr-2" />
                  <div>
                    <p className="text-xs text-gray-500">Access Level</p>
                    <p className="text-sm font-medium text-gray-900">
                      Restricted
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-600 mb-6">
                If you believe this is an error, please contact the
                administrator or try accessing from an authorized location.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Security System. All rights reserved.
      </div>
    </div>
  );
}

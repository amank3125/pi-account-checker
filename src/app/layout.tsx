import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "./providers";
import AuthButton from "@/components/auth/AuthButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pi Account Manager",
  description: "Manage your Pi Network accounts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {/* Absolute positioned auth button */}
          <div className="absolute top-0 right-0 z-50 p-3">
            <AuthButton />
          </div>

          {/* Main content */}
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import SessionProvider from "@/components/auth/SessionProvider";
import UserMenu from "@/components/auth/UserMenu";
import SignOutButton from "@/components/auth/SignOutButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OBD Premium Apps",
  description: "Access all your Ocala-focused AI tools in one place",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body className={`${inter.className} antialiased min-h-screen flex flex-col`}>
        <SessionProvider>
          <header className="w-full bg-[#050816] text-white shadow-md border-b-2 border-[#29c4a9]/60">
            <div className="mx-auto max-w-7xl px-6 py-4">
              {/* 3-column layout: Left | Middle | Right */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* LEFT: Logo + Product Title */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <img src="/obd-logo.png" alt="OBD Logo" className="h-10 w-auto" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs uppercase tracking-wide text-teal-300">
                      Ocala Business Directory
                    </span>
                    <span className="text-lg font-semibold text-white">
                      OBD Premium Apps
                    </span>
                  </div>
                </div>
                
                {/* MIDDLE: Logged in as (centered, flex-1) */}
                <div className="flex-1 flex justify-center min-w-0 hidden md:flex">
                  <UserMenu />
                </div>
                
                {/* RIGHT: Buttons */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
                  <Link
                    href="https://ocalabusinessdirectory.com"
                    className="rounded-full bg-gradient-to-r from-[#1EB9A7] to-[#0AC8E9] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 transition whitespace-nowrap"
                    aria-label="Return to Ocala Business Directory"
                  >
                    Return to Directory
                  </Link>
                  <SignOutButton />
                </div>
              </div>
              
              {/* Mobile: Logged in as (shown below on small screens) */}
              <div className="flex justify-center mt-3 md:hidden">
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
          <footer className="w-full bg-[#050816] text-slate-400 border-t border-[#29c4a9]/40 py-4">
            <div className="max-w-6xl mx-auto px-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-xs md:text-sm">
                © {currentYear} OBD Business Suite · Ocala Business Directory
              </p>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link
                  href="/help"
                  className="text-xs md:text-sm text-slate-400 hover:text-[#29c4a9] transition-colors"
                >
                  Help Center
                </Link>
                <a
                  href="mailto:support@ocalabusinessdirectory.com"
                  className="text-xs md:text-sm text-slate-400 hover:text-[#29c4a9] transition-colors"
                >
                  Support
                </a>
                <a
                  href="https://ocalabusinessdirectory.com/obd-business-suite-privacy-policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs md:text-sm text-slate-400 hover:text-[#29c4a9] transition-colors"
                >
                  Privacy
                </a>
                <a
                  href="https://ocalabusinessdirectory.com/obd-business-suite-terms-of-service/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs md:text-sm text-slate-400 hover:text-[#29c4a9] transition-colors"
                >
                  Terms
                </a>
              </div>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}

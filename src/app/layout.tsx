import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

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
        <header className="w-full bg-[#050816] text-white shadow-md border-b-2 border-[#29c4a9]/60">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-3">
              <Link
                href="https://ocalabusinessdirectory.com"
                className="rounded-full bg-gradient-to-r from-[#1EB9A7] to-[#0AC8E9] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 transition"
              >
                Return to Directory
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Login to Premium
              </Link>
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
              <Link
                href="/privacy"
                className="text-xs md:text-sm text-slate-400 hover:text-[#29c4a9] transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-xs md:text-sm text-slate-400 hover:text-[#29c4a9] transition-colors"
              >
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

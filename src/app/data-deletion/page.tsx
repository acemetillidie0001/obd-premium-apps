"use client";

import OBDPageContainer from "@/components/obd/OBDPageContainer";
import OBDPanel from "@/components/obd/OBDPanel";
import OBDHeading from "@/components/obd/OBDHeading";
import { getThemeClasses } from "@/lib/obd-framework/theme";
import { useState } from "react";

export default function DataDeletionPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const themeClasses = getThemeClasses(isDark);

  return (
    <OBDPageContainer
      isDark={isDark}
      onThemeToggle={() => setTheme(isDark ? "light" : "dark")}
      title="Data Deletion Request"
      tagline="Request deletion of your Social Auto-Poster data"
    >
      <div className="mt-7">
        <OBDPanel isDark={isDark}>
          <OBDHeading level={1} isDark={isDark} className="mb-4">
            Data Deletion Request
          </OBDHeading>

          <div className={`space-y-6 ${themeClasses.mutedText}`}>
            <div>
              <h2 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                What Data We Store
              </h2>
              <p className="mb-2">
                When you use the Social Auto-Poster, we store the following data:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>OAuth Tokens:</strong> Encrypted access tokens and refresh tokens for connected social accounts (Facebook, Instagram, Google Business Profile)</li>
                <li><strong>Connection Metadata:</strong> Your user ID, platform type, provider account ID (Page/Account ID), display name, and selected posting destination</li>
                <li><strong>Post Data:</strong> Post content (text), image URLs (hosted by us), scheduled times, post status, and delivery attempt logs</li>
              </ul>
            </div>

            <div>
              <h2 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                What We DON'T Store
              </h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Passwords:</strong> We never have access to or store your Facebook, Instagram, or Google passwords</li>
                <li><strong>Existing Posts:</strong> We don't read or store your existing social media posts</li>
                <li><strong>Analytics Data:</strong> We don't store engagement metrics, comments, or any analytics data from your posts</li>
                <li><strong>Personal Information:</strong> Beyond what's necessary for posting, we don't collect additional personal information</li>
              </ul>
            </div>

            <div>
              <h2 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                How to Request Deletion
              </h2>
              <p className="mb-3">
                To request deletion of your Social Auto-Poster data, please email us at:
              </p>
              <div className={`p-4 rounded-lg border ${
                isDark 
                  ? "border-slate-700 bg-slate-800/50" 
                  : "border-slate-200 bg-slate-50"
              }`}>
                <a
                  href="mailto:support@ocalabusinessdirectory.com?subject=Data Deletion Request - Social Auto-Poster"
                  className={`text-lg font-medium ${isDark ? "text-[#29c4a9]" : "text-[#1EB9A7]"}`}
                >
                  support@ocalabusinessdirectory.com
                </a>
              </div>
              <p className="mt-3">
                Please include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                <li>Your account email address</li>
                <li>A clear statement that you want to delete your Social Auto-Poster data</li>
                <li>Confirmation that you understand this will disconnect all social accounts and delete all queued posts</li>
              </ul>
            </div>

            <div>
              <h2 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                What Happens After Your Request
              </h2>
              <p className="mb-2">
                Once we receive your request, we will:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Verify your identity (to ensure the request is legitimate)</li>
                <li>Disconnect all connected social accounts (Facebook, Instagram, Google Business Profile)</li>
                <li>Delete all stored OAuth tokens and connection data</li>
                <li>Delete all queued and scheduled posts</li>
                <li>Delete all post history and activity logs</li>
                <li>Confirm deletion via email</li>
              </ol>
              <p className="mt-3">
                <strong>Timeline:</strong> We process deletion requests promptly, typically within 7 business days of verification.
              </p>
            </div>

            <div>
              <h2 className={`text-lg font-semibold mb-3 ${themeClasses.headingText}`}>
                Quick Disconnect (Self-Service)
              </h2>
              <p className="mb-2">
                You can also disconnect your accounts immediately without requesting full data deletion:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Go to <strong>Social Auto-Poster → Setup</strong></li>
                <li>Click <strong>"Disconnect"</strong> for each connected platform</li>
                <li>This immediately removes all tokens and stops all posting</li>
                <li>Note: This removes connection data but may not delete all post history (use email request for complete deletion)</li>
              </ul>
            </div>

            <div className={`p-4 rounded-lg border ${
              isDark 
                ? "border-blue-700/50 bg-blue-900/20" 
                : "border-blue-200 bg-blue-50"
            }`}>
              <p className={`text-sm ${isDark ? "text-blue-300" : "text-blue-800"}`}>
                <strong>Note:</strong> Deleting your data will permanently remove all connection information and post history. 
                You will need to reconnect your accounts if you want to use Social Auto-Poster again in the future.
              </p>
            </div>
          </div>
        </OBDPanel>
      </div>
    </OBDPageContainer>
  );
}


"use client";

/**
 * Help Center page for public route group
 * Prevents 404 prefetch errors from any public routes
 */
export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Help Center</h1>
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-slate-600 mb-4">
            Help center coming soon. For immediate assistance, please contact our support team.
          </p>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              <strong>Email:</strong>{" "}
              <a
                href="mailto:support@ocalabusinessdirectory.com"
                className="text-teal-600 hover:text-teal-700 underline"
              >
                support@ocalabusinessdirectory.com
              </a>
            </p>
          </div>
        </div>
        <div className="text-center">
          <a
            href="/"
            className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}


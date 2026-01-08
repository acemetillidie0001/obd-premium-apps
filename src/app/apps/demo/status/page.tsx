import { cookies, headers } from "next/headers";
import { hasDemoCookie } from "@/lib/demo/demo-cookie";
import OBDPanel from "@/components/obd/OBDPanel";

/**
 * TEMP DEBUG PAGE — REMOVE AFTER DEMO VERIFICATION
 * 
 * This page displays debug information about the request and demo cookie status.
 * Accessible at /apps/demo/status (no auth required due to /apps/demo/* route pattern).
 */
export default async function DemoStatusPage() {
  // Get request information
  const headersList = await headers();
  const host = headersList.get("host") || "unknown";
  const cookieStore = await cookies();
  const hasDemo = hasDemoCookie(cookieStore);
  
  // Pathname is known since this is /apps/demo/status
  const pathname = "/apps/demo/status";

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Demo Mode Debug Status
          </h1>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            ⚠️ TEMP DEBUG PAGE — REMOVE AFTER DEMO VERIFICATION
          </p>
        </div>

        <OBDPanel isDark={false}>
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Request Information
              </h2>
              
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Host
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded">
                    {host}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Pathname
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded">
                    {pathname}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Demo Cookie (obd_demo)
                  </dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      hasDemo 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {hasDemo ? "✓ Present" : "✗ Not Present"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This debug page checks the demo cookie server-side using Next.js cookies() API.
                It is accessible without authentication due to the /apps/demo/* route pattern.
              </p>
            </div>
          </div>
        </OBDPanel>
      </div>
    </div>
  );
}


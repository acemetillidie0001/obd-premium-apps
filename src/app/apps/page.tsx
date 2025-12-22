import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/apps");
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Premium Apps Dashboard</h1>
          
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-semibold text-slate-700 mb-2">Session Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Email</dt>
                  <dd className="text-base text-slate-900">{session.user.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Role</dt>
                  <dd className="text-base text-slate-900">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {session.user.role}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Premium Status</dt>
                  <dd className="text-base text-slate-900">
                    {session.user.isPremium ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Premium
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Standard
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="pt-4">
              <p className="text-sm text-slate-600">
                Welcome to your Premium Apps dashboard. Use the navigation to access individual apps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


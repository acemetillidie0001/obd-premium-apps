import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SEO_AUDIT_SECTION_DEFS } from "@/app/apps/seo-audit-roadmap/sections";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "SEO Audit Report (Read-only)",
    robots: {
      index: false,
      follow: false,
      nocache: true,
    },
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

export default async function SeoAuditSharePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const cleanToken = (token || "").trim();
  if (!cleanToken) notFound();

  const now = new Date();

  const share = await prisma.seoAuditShareToken.findUnique({
    where: { token: cleanToken },
    select: {
      businessId: true,
      auditReportId: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  if (!share) notFound();
  if (share.revokedAt) notFound();
  if (share.expiresAt <= now) notFound();

  // Fetch exactly one audit snapshot and ensure it's scoped to the same businessId.
  const report = await prisma.seoAuditReport.findFirst({
    where: {
      id: share.auditReportId,
      businessId: share.businessId,
      status: "COMPLETED",
    },
    select: {
      id: true,
      findings: true,
      roadmap: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  if (!report) notFound();

  const findings = report.findings as any;
  const roadmap = Array.isArray(report.roadmap as any) ? (report.roadmap as any[]) : [];
  const categoryResults = Array.isArray(findings?.categoryResults) ? findings.categoryResults : [];

  const generatedOn = (report.completedAt ?? report.updatedAt).toISOString();
  const expiresOn = share.expiresAt.toISOString();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-lg font-semibold">SEO Audit &amp; Roadmap (Read-only)</div>
          <div className="mt-1 text-sm text-slate-600">
            Read-only snapshot. Expires on <span className="font-medium">{formatDate(expiresOn)}</span>.
          </div>

          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-900">
              Maintenance Mode (Reference-Quality)
            </div>
            <div className="mt-1 text-sm text-amber-800">
              Advisory-only. Draft outputs. No automatic changes.
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-600">
            Report ID: <span className="font-mono">{report.id}</span> · Generated on{" "}
            <span className="font-medium">{formatDate(generatedOn)}</span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-600">Score</div>
              <div className="text-xl font-semibold">{typeof findings?.score === "number" ? findings.score : "—"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-600">Band</div>
              <div className="text-sm font-semibold">{typeof findings?.band === "string" ? findings.band : "—"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-600">Summary</div>
              <div className="text-sm">{typeof findings?.summary === "string" ? findings.summary : "—"}</div>
            </div>
          </div>

          <div className="mt-5 text-xs text-slate-600">
            Advisory only. Nothing is changed automatically.
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {SEO_AUDIT_SECTION_DEFS.map((section) => {
            const cats = categoryResults.filter((c: any) => section.categoryKeys.includes(c?.key));
            if (cats.length === 0) return null;

            return (
              <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold">{section.title}</div>
                <div className="mt-3 space-y-3">
                  {cats.map((c: any) => (
                    <div key={c.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">
                            {c.label}{" "}
                            <span className="text-xs font-normal text-slate-600">
                              ({c.pointsEarned}/{c.pointsMax})
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-700">{c.shortExplanation}</div>
                          <div className="mt-2 text-sm text-slate-600">
                            <span className="font-medium">Fix:</span> {c.fixRecommendation}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700">
                            {c.status}
                          </span>
                        </div>
                      </div>
                      {c.confidence && (
                        <div className="mt-3 text-xs text-slate-600">
                          Confidence: <span className="font-medium">{c.confidence}</span>
                        </div>
                      )}
                      {c.evidence && (
                        <details className="mt-3">
                          <summary className="cursor-pointer select-none text-xs font-semibold text-slate-800">
                            Evidence
                          </summary>
                          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                            {Array.isArray(c.evidence.checked) && c.evidence.checked.length > 0 && (
                              <div className="mb-2">
                                <div className="font-semibold">Checked</div>
                                <ul className="mt-1 list-disc pl-5 space-y-1">
                                  {c.evidence.checked.map((x: string, idx: number) => (
                                    <li key={`chk-${c.key}-${idx}`}>{x}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {Array.isArray(c.evidence.observed) && c.evidence.observed.length > 0 && (
                              <div className="mb-2">
                                <div className="font-semibold">Observed</div>
                                <ul className="mt-1 list-disc pl-5 space-y-1">
                                  {c.evidence.observed.map((x: string, idx: number) => (
                                    <li key={`obs-${c.key}-${idx}`}>{x}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {typeof c.evidence.notes === "string" && c.evidence.notes.trim() && (
                              <div>
                                <div className="font-semibold">Notes</div>
                                <div className="mt-1">{c.evidence.notes}</div>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold">Roadmap (Read-only)</div>
          {Array.isArray(roadmap) && roadmap.length > 0 ? (
            <div className="mt-3 space-y-3">
              {roadmap.map((item: any) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        Impact: {item.priority} · Effort: {item.estimatedEffort}
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        <span className="font-medium">Issue:</span> {item.whatIsWrong}
                      </div>
                      <div className="mt-2 text-sm text-slate-700">
                        <span className="font-medium">Why it matters:</span> {item.whyItMatters}
                      </div>
                      {Array.isArray(item.nextSteps) && item.nextSteps.length > 0 && (
                        <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-slate-700">
                          {item.nextSteps.map((s: string, idx: number) => (
                            <li key={`${item.id}-step-${idx}`}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600">No roadmap items available.</div>
          )}
        </div>
      </div>
    </main>
  );
}



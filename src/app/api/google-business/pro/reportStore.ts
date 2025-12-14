import { prisma } from "@/lib/prisma";
import type { ProReport } from "@prisma/client";

export async function saveProReport(data: {
  shareId: string;
  accessToken?: string | null;
  html: string;
  pdfBase64?: string | null;
  businessName: string;
  city: string;
  state: string;
  score: number;
  expiresAt?: Date | null;
}): Promise<ProReport> {
  return prisma.proReport.create({
    data: {
      shareId: data.shareId,
      html: data.html,
      pdfBase64: data.pdfBase64 ?? null,
      businessName: data.businessName,
      city: data.city,
      state: data.state,
      score: data.score,
      accessToken: data.accessToken ?? null,
      expiresAt: data.expiresAt ?? null,
    },
  });
}

export async function getProReportByShareId(shareId: string): Promise<ProReport | null> {
  return prisma.proReport.findUnique({
    where: { shareId },
  });
}

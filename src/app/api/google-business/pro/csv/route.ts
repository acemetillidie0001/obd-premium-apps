import { NextResponse } from "next/server";
import { GoogleBusinessProResult, GoogleBusinessProCsvExport } from "@/app/apps/google-business-pro/types";

/**
 * Extract business name from proResult (best-effort)
 */
function extractBusinessName(result: GoogleBusinessProResult): string {
  const shortDesc = result.content.shortDescription || "";
  const longDesc = result.content.longDescription || "";
  
  const nameMatch = shortDesc.match(/^([^,\.]+)/) || longDesc.match(/^([^,\.]+)/);
  if (nameMatch && nameMatch[1].trim().length > 0 && nameMatch[1].trim().length < 50) {
    return nameMatch[1].trim();
  }
  return "Unknown Business";
}

/**
 * Extract city/state from proResult (best-effort, defaults to Ocala, FL)
 */
function extractLocation(result: GoogleBusinessProResult): { city: string; state: string } {
  // Default to Ocala, Florida
  // Could be enhanced to extract from content if available
  return { city: "Ocala", state: "Florida" };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proResults }: { proResults: GoogleBusinessProResult[] } = body;

    // Validate input
    if (!Array.isArray(proResults) || proResults.length === 0) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    // Validate each result
    for (const result of proResults) {
      if (!result || !result.audit || !result.content) {
        return NextResponse.json(
          { error: "Invalid request body." },
          { status: 400 }
        );
      }
    }

    // Build CSV headers
    const headers = [
      "businessName",
      "city",
      "state",
      "auditScore",
      "strengthCount",
      "issueCount",
      "faqCount",
      "postIdeaCount",
    ];

    // Build CSV rows
    const rows = proResults.map((result) => {
      const businessName = extractBusinessName(result);
      const { city, state } = extractLocation(result);
      const auditScore = result.audit.score ?? 0;
      const strengthCount = result.audit.strengths?.length ?? 0;
      const issueCount = result.audit.issues?.length ?? 0;
      const faqCount = result.content.faqSuggestions?.length ?? 0;
      const postIdeaCount = result.content.postIdeas?.length ?? 0;

      // Escape CSV values (handle commas and quotes)
      const escapeCsv = (value: string | number): string => {
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeCsv(businessName),
        escapeCsv(city),
        escapeCsv(state),
        escapeCsv(auditScore),
        escapeCsv(strengthCount),
        escapeCsv(issueCount),
        escapeCsv(faqCount),
        escapeCsv(postIdeaCount),
      ].join(",");
    });

    // Combine headers and rows
    const csvContent = [headers.join(","), ...rows].join("\n");

    // Generate filename with timestamp
    const filename = `gbp-pro-export-${Date.now()}.csv`;

    const exportData: GoogleBusinessProCsvExport = {
      filename,
      csvContent,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Error generating CSV export:", error);
    return NextResponse.json(
      { error: "Failed to generate CSV export" },
      { status: 500 }
    );
  }
}

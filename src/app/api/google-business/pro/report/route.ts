import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  GoogleBusinessProResult,
  GoogleBusinessProReportOptions,
  GoogleBusinessProReportExport,
} from "@/app/apps/google-business-pro/types";
import { saveProReport } from "../reportStore";

/**
 * Generate a shareable ID (simple UUID-like string)
 */
function generateShareId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate PDF report from Pro result
 */
async function generatePDFReport(
  result: GoogleBusinessProResult,
  options: GoogleBusinessProReportOptions = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const margin = 50;
  const pageWidth = page.getSize().width;
  const pageHeight = page.getSize().height;
  const maxWidth = pageWidth - 2 * margin;
  let y = pageHeight - margin;
  const lineHeight = 14;
  const sectionSpacing = 20;

  // Helper to wrap text
  const wrapText = (text: string, width: number, font: any, fontSize: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > width && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Helper to add text with wrapping
  let currentPage = page;
  const addText = (text: string, fontSize: number, isBold = false, color = rgb(0, 0, 0)) => {
    const lines = wrapText(text, maxWidth, isBold ? boldFont : font, fontSize);
    for (const line of lines) {
      if (y < margin + 30) {
        // Add new page if needed
        currentPage = pdfDoc.addPage([612, 792]);
        y = pageHeight - margin;
      }
      currentPage.drawText(line, {
        x: margin,
        y: y,
        size: fontSize,
        font: isBold ? boldFont : font,
        color: color,
      });
      y -= lineHeight;
    }
  };

  // Title
  const reportTitle = options.reportTitle || "Google Business Profile Analysis";
  y -= 10;
  addText(reportTitle, 20, true);
  y -= sectionSpacing;

  // Date
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  addText(`Generated on ${dateStr}`, 10, false, rgb(0.4, 0.4, 0.4));
  y -= sectionSpacing * 2;

  // Audit Score
  addText("Audit Summary", 16, true);
  y -= 5;
  addText(`Score: ${result.audit.score}/100`, 14, true, 
    result.audit.score >= 80 ? rgb(0, 0.7, 0) : result.audit.score >= 60 ? rgb(0.9, 0.6, 0) : rgb(0.9, 0.3, 0.3));
  y -= 5;
  addText(result.audit.summary, 11);
  y -= sectionSpacing;

  // Strengths
  if (result.audit.strengths.length > 0) {
    addText("Strengths", 14, true);
    y -= 5;
    result.audit.strengths.slice(0, 5).forEach(strength => {
      addText(`• ${strength}`, 10);
      y -= 3;
    });
    y -= sectionSpacing;
  }

  // Issues
  if (result.audit.issues.length > 0) {
    addText("Issues Found", 14, true);
    y -= 5;
    result.audit.issues.slice(0, 5).forEach(issue => {
      addText(`• ${issue}`, 10);
      y -= 3;
    });
    y -= sectionSpacing;
  }

  // Short Description
  addText("Short Description", 14, true);
  y -= 5;
  addText(result.content.shortDescription, 11);
  y -= sectionSpacing;

  // Long Description
  addText("Long Description", 14, true);
  y -= 5;
  addText(result.content.longDescription, 11);
  y -= sectionSpacing;

  // FAQs (first 3)
  if (result.content.faqSuggestions.length > 0) {
    addText("FAQ Suggestions", 14, true);
    y -= 5;
    result.content.faqSuggestions.slice(0, 3).forEach((faq, idx) => {
      addText(`Q${idx + 1}: ${faq.question}`, 11, true);
      y -= 3;
      addText(`A: ${faq.answer}`, 10);
      y -= sectionSpacing / 2;
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Generate styled HTML report from Pro result
 */
function generateHTMLReport(
  result: GoogleBusinessProResult,
  options: GoogleBusinessProReportOptions = {}
): string {
  const theme = options.theme || "light";
  const sections = options.includeSections || {};
  const reportTitle = options.reportTitle || `${result.audit.summary.split(".")[0]} - Google Business Profile Analysis`;

  // Default to including all sections if not specified
  const includeAuditSummary = sections.auditSummary !== false;
  const includeStrengths = sections.strengths !== false;
  const includeIssues = sections.issues !== false;
  const includeQuickWins = sections.quickWins !== false;
  const includePriorityFixes = sections.priorityFixes !== false;
  const includeDescriptions = sections.descriptions !== false;
  const includeFaqs = sections.faqs !== false;
  const includePosts = sections.posts !== false;
  const includeKeywords = sections.keywords !== false;

  const bgColor = theme === "dark" ? "#1e293b" : "#ffffff";
  const textColor = theme === "dark" ? "#f1f5f9" : "#1e293b";
  const borderColor = theme === "dark" ? "#475569" : "#e2e8f0";
  const cardBg = theme === "dark" ? "#334155" : "#f8fafc";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: ${bgColor};
      color: ${textColor};
      line-height: 1.6;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: ${cardBg};
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    h1 {
      font-size: 28px;
      margin-bottom: 10px;
      color: ${textColor};
    }
    h2 {
      font-size: 22px;
      margin-top: 32px;
      margin-bottom: 16px;
      color: ${textColor};
      border-bottom: 2px solid ${borderColor};
      padding-bottom: 8px;
    }
    h3 {
      font-size: 18px;
      margin-top: 24px;
      margin-bottom: 12px;
      color: ${textColor};
    }
    .score-card {
      text-align: center;
      padding: 24px;
      background: ${bgColor};
      border-radius: 8px;
      margin: 24px 0;
      border: 2px solid ${borderColor};
    }
    .score-value {
      font-size: 48px;
      font-weight: bold;
      margin: 8px 0;
    }
    .score-good { color: #10b981; }
    .score-medium { color: #f59e0b; }
    .score-poor { color: #ef4444; }
    ul, ol {
      margin-left: 24px;
      margin-top: 8px;
    }
    li {
      margin-bottom: 8px;
    }
    .section {
      margin-bottom: 32px;
    }
    .card {
      background: ${bgColor};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
    .badge-high { background: #fee2e2; color: #991b1b; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #dbeafe; color: #1e40af; }
    .keyword-pill {
      display: inline-block;
      padding: 6px 12px;
      background: ${cardBg};
      border: 1px solid ${borderColor};
      border-radius: 16px;
      margin: 4px;
      font-size: 14px;
    }
    @media print {
      body { padding: 0; }
      .container { box-shadow: none; }
    }
    @media (max-width: 600px) {
      .container { padding: 20px; }
      h1 { font-size: 24px; }
      h2 { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${reportTitle}</h1>
    <p style="color: ${theme === "dark" ? "#94a3b8" : "#64748b"}; margin-bottom: 32px;">
      Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
    </p>

    ${includeAuditSummary ? `
    <div class="section">
      <h2>Audit Summary</h2>
      <div class="score-card">
        <div class="score-value ${result.audit.score >= 80 ? "score-good" : result.audit.score >= 60 ? "score-medium" : "score-poor"}">
          ${result.audit.score}/100
        </div>
        <p style="margin-top: 12px; font-size: 16px;">${result.audit.summary}</p>
      </div>
    </div>
    ` : ""}

    ${includeStrengths && result.audit.strengths.length > 0 ? `
    <div class="section">
      <h2>Strengths</h2>
      <ul>
        ${result.audit.strengths.map(s => `<li>${s}</li>`).join("")}
      </ul>
    </div>
    ` : ""}

    ${includeIssues && result.audit.issues.length > 0 ? `
    <div class="section">
      <h2>Issues Found</h2>
      <ul>
        ${result.audit.issues.map(i => `<li>${i}</li>`).join("")}
      </ul>
    </div>
    ` : ""}

    ${includeQuickWins && result.audit.quickWins.length > 0 ? `
    <div class="section">
      <h2>Quick Wins</h2>
      <ul>
        ${result.audit.quickWins.map(w => `<li>${w}</li>`).join("")}
      </ul>
    </div>
    ` : ""}

    ${includePriorityFixes && result.audit.priorityFixes.length > 0 ? `
    <div class="section">
      <h2>Priority Fixes</h2>
      ${result.audit.priorityFixes.map(fix => `
        <div class="card">
          <h3>${fix.title} <span class="badge badge-${fix.impact.toLowerCase()}">${fix.impact}</span></h3>
          <p>${fix.description}</p>
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${includeDescriptions ? `
    <div class="section">
      <h2>Content Descriptions</h2>
      <div class="card">
        <h3>Short Description</h3>
        <p>${result.content.shortDescription}</p>
      </div>
      <div class="card">
        <h3>Long Description</h3>
        <p style="white-space: pre-wrap;">${result.content.longDescription}</p>
      </div>
      <div class="card">
        <h3>Services Section</h3>
        <p style="white-space: pre-wrap;">${result.content.servicesSection}</p>
      </div>
      <div class="card">
        <h3>About Section</h3>
        <p style="white-space: pre-wrap;">${result.content.aboutSection}</p>
      </div>
    </div>
    ` : ""}

    ${includeFaqs && result.content.faqSuggestions.length > 0 ? `
    <div class="section">
      <h2>FAQ Suggestions</h2>
      ${result.content.faqSuggestions.map((faq, idx) => `
        <div class="card">
          <h3>Q${idx + 1}: ${faq.question}</h3>
          <p>A: ${faq.answer}</p>
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${includePosts && result.content.postIdeas.length > 0 ? `
    <div class="section">
      <h2>Post Ideas</h2>
      <ul>
        ${result.content.postIdeas.map(idea => `<li>${idea}</li>`).join("")}
      </ul>
    </div>
    ` : ""}

    ${includeKeywords && result.content.keywordSuggestions.length > 0 ? `
    <div class="section">
      <h2>Keyword Suggestions</h2>
      <div>
        ${result.content.keywordSuggestions.map(kw => `<span class="keyword-pill">${kw}</span>`).join("")}
      </div>
    </div>
    ` : ""}

  </div>
</body>
</html>`;
}

/**
 * Extract business metadata from proResult (best-effort)
 */
function extractMetadata(proResult: GoogleBusinessProResult): {
  businessName: string;
  city: string;
  state: string;
  score?: number;
} {
  // Try to extract business name from content
  let businessName = "Your Business";
  const shortDesc = proResult.content.shortDescription || "";
  const longDesc = proResult.content.longDescription || "";
  
  // Look for business name patterns in descriptions
  const nameMatch = shortDesc.match(/^([^,\.]+)/) || longDesc.match(/^([^,\.]+)/);
  if (nameMatch && nameMatch[1].trim().length > 0 && nameMatch[1].trim().length < 50) {
    businessName = nameMatch[1].trim();
  }

  // Default city/state (could be enhanced to extract from content)
  const city = "Ocala";
  const state = "Florida";

  return {
    businessName,
    city,
    state,
    score: proResult.audit?.score,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { proResult, options }: { proResult: GoogleBusinessProResult; options?: GoogleBusinessProReportOptions } = body;

    // Basic validation
    if (!proResult || !proResult.audit || !proResult.content) {
      return NextResponse.json(
        { error: "Invalid proResult. Must include audit and content." },
        { status: 400 }
      );
    }

    // Generate HTML report
    const html = generateHTMLReport(proResult, options);

    // Generate shareable ID
    const shareId = generateShareId();

    // Generate PDF
    const pdfBytes = await generatePDFReport(proResult, options);
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // Placeholder path for future server-side storage
    const pdfPath = `/reports/gbp-pro/${shareId}.pdf`;

    // Extract metadata
    const metadata = extractMetadata(proResult);

    // Generate access token
    const accessToken =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "")
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Calculate expiration (30 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Store report in database
    await saveProReport({
      shareId,
      html,
      pdfBase64,
      businessName: metadata.businessName,
      city: metadata.city,
      state: metadata.state,
      score: metadata.score ?? 0,
      accessToken,
      expiresAt,
    });

    const exportData: GoogleBusinessProReportExport = {
      html,
      shareId,
      pdfPath,
      pdfBase64,
      accessToken,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

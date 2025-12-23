import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PDFDocument, PDFFont, rgb, StandardFonts } from "pdf-lib";
import { BrandKitBuilderResponse } from "@/app/apps/brand-kit-builder/types";

// Generate request ID for error tracking
function generateRequestId(): string {
  return `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const isDev = process.env.NODE_ENV !== "production";

  try {
    // Authentication check (skip in dev for script testing)
    if (!isDev) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          {
            ok: false,
            error: "Authentication required",
            requestId,
          },
          { status: 401 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    let brandKit: BrandKitBuilderResponse | undefined = body.brandKit;

    // Dev convenience: if brandKit is missing but body looks like a request, generate it
    if (!brandKit && isDev && body.businessName && body.businessType) {
      try {
        // Make internal call to generate brand kit
        // Use request.nextUrl.origin for robust URL construction (works even if Origin header missing)
        const baseUrl = request.nextUrl.origin || "http://localhost:3000";
        const generateResponse = await fetch(`${baseUrl}/api/brand-kit-builder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json().catch(() => ({}));
          return NextResponse.json(
            {
              ok: false,
              error: `Failed to generate brand kit: ${errorData.error || generateResponse.statusText}`,
              requestId,
            },
            { status: generateResponse.status }
          );
        }

        const generateData = await generateResponse.json();
        if (generateData.ok && generateData.data) {
          brandKit = generateData.data;
        } else {
          return NextResponse.json(
            {
              ok: false,
              error: "Failed to generate brand kit: invalid response",
              requestId,
            },
            { status: 500 }
          );
        }
      } catch (error: any) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to generate brand kit: ${error?.message || "Unknown error"}`,
            requestId,
          },
          { status: 500 }
        );
      }
    }

    if (!brandKit) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing brandKit in request body",
          requestId,
        },
        { status: 400 }
      );
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]); // US Letter size
    const { width, height } = page.getSize();

    // Load fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPosition = height - 50; // Start from top
    const margin = 50;
    const rightMargin = 80; // Increased right padding for professional appearance
    const lineHeight = 20;
    const sectionSpacing = 30;

    // Helper function to sanitize text for PDF (replace newlines and non-printable chars)
    const sanitizeText = (text: string): string => {
      return text
        .replace(/\r\n/g, " ") // Windows newlines
        .replace(/\n/g, " ") // Unix newlines
        .replace(/\r/g, " ") // Mac newlines
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " "); // Remove non-printable chars except tab
    };

    // Helper function to add text with word wrapping
    const addText = (
      text: string,
      x: number,
      y: number,
      fontSize: number,
      font: PDFFont,
      color: [number, number, number] = [0, 0, 0],
      maxWidth?: number
    ): number => {
      // Sanitize text before processing
      text = sanitizeText(text);
      if (maxWidth) {
        const words = text.split(" ");
        let line = "";
        let currentY = y;
        for (const word of words) {
          const testLine = line + word + " ";
          const width = font.widthOfTextAtSize(testLine, fontSize);
          if (width > maxWidth && line.length > 0) {
            page.drawText(line, {
              x,
              y: currentY,
              size: fontSize,
              font,
              color: rgb(color[0], color[1], color[2]),
            });
            line = word + " ";
            currentY -= lineHeight;
          } else {
            line = testLine;
          }
        }
        if (line.length > 0) {
          page.drawText(line, {
            x,
            y: currentY,
            size: fontSize,
            font,
            color: rgb(color[0], color[1], color[2]),
          });
        }
        return currentY;
      } else {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(color[0], color[1], color[2]),
        });
        return y;
      }
    };

    // Header
    page.drawText(sanitizeText("OBD Premium Apps"), {
      x: margin,
      y: yPosition,
      size: 24,
      font: helveticaBoldFont,
      color: rgb(0.12, 0.71, 0.65), // OBD teal
    });
    yPosition -= 30;

    page.drawText(sanitizeText("Brand Kit Export"), {
      x: margin,
      y: yPosition,
      size: 18,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 40;

    // Business Info
    page.drawText(sanitizeText(`Business: ${brandKit.brandSummary.businessName}`), {
      x: margin,
      y: yPosition,
      size: 12,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    if (brandKit.brandSummary.tagline) {
      page.drawText(sanitizeText(`Tagline: ${brandKit.brandSummary.tagline}`), {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaFont,
      });
      yPosition -= lineHeight;
    }

    page.drawText(
      sanitizeText(`Generated: ${new Date(brandKit.meta.createdAtISO).toLocaleString()}`),
      {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      }
    );
    yPosition -= lineHeight;

    page.drawText(sanitizeText(`Request ID: ${brandKit.meta.requestId}`), {
      x: margin,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= sectionSpacing;

    // Brand Summary
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage([612, 792]);
      page = newPage;
      yPosition = height - 50;
    }

    page.drawText("Brand Summary", {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight + 5;

    yPosition = addText(
      brandKit.brandSummary.positioning,
      margin,
      yPosition,
      11,
      helveticaFont,
      [0.2, 0.2, 0.2],
      width - margin - rightMargin
    );
    yPosition -= sectionSpacing;

    // Color Palette
    if (yPosition < 150) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }

    page.drawText("Color Palette", {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight + 10;

    for (const color of brandKit.colorPalette.colors) {
      if (yPosition < 80) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
      }

      // Draw color swatch
      page.drawRectangle({
        x: margin,
        y: yPosition - 15,
        width: 30,
        height: 15,
        color: rgb(
          parseInt(color.hex.slice(1, 3), 16) / 255,
          parseInt(color.hex.slice(3, 5), 16) / 255,
          parseInt(color.hex.slice(5, 7), 16) / 255
        ),
      });

      page.drawText(sanitizeText(`${color.name}: ${color.hex}`), {
        x: margin + 35,
        y: yPosition,
        size: 11,
        font: helveticaBoldFont,
      });
      yPosition -= lineHeight;

      yPosition = addText(
        color.usageGuidance,
        margin + 35,
        yPosition,
        10,
        helveticaFont,
        [0.4, 0.4, 0.4],
        width - margin - 35 - rightMargin
      );
      yPosition -= lineHeight + 5;
    }
    yPosition -= sectionSpacing - 20;

    // Typography
    if (yPosition < 100) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }

    page.drawText("Typography", {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight + 5;

    page.drawText(
      sanitizeText(`Headline: ${brandKit.typography.headlineFont}`),
      {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaFont,
      }
    );
    yPosition -= lineHeight;

    page.drawText(sanitizeText(`Body: ${brandKit.typography.bodyFont}`), {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaFont,
    });
    yPosition -= lineHeight;

    yPosition = addText(
      brandKit.typography.usageNotes,
      margin,
      yPosition,
      10,
      helveticaFont,
      [0.4, 0.4, 0.4],
      width - margin - rightMargin
    );
    yPosition -= sectionSpacing;

    // Brand Voice
    if (yPosition < 150) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }

    page.drawText("Brand Voice", {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight + 5;

    yPosition = addText(
      brandKit.brandVoice.description,
      margin,
      yPosition,
      11,
      helveticaFont,
      [0.2, 0.2, 0.2],
      width - margin - rightMargin
    );
    yPosition -= lineHeight + 10;

    page.drawText("Do:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    for (const item of brandKit.brandVoice.do) {
      page.drawText(sanitizeText(`• ${item}`), {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= lineHeight;
    }

    yPosition -= 5;
    page.drawText("Don't:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    for (const item of brandKit.brandVoice.dont) {
      page.drawText(sanitizeText(`• ${item}`), {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= lineHeight;
    }
    yPosition -= sectionSpacing;

    // Messaging
    if (yPosition < 200) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }

    page.drawText("Messaging", {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight + 5;

    page.drawText("Taglines:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    for (const tagline of brandKit.messaging.taglines) {
      page.drawText(sanitizeText(`• ${tagline}`), {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= lineHeight;
    }

    yPosition -= 5;
    page.drawText("Value Props:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    for (const prop of brandKit.messaging.valueProps) {
      page.drawText(sanitizeText(`• ${prop}`), {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      });
      yPosition -= lineHeight;
    }

    yPosition -= 10;
    page.drawText("Elevator Pitch:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    yPosition = addText(
      brandKit.messaging.elevatorPitch,
      margin,
      yPosition,
      10,
      helveticaFont,
      [0.2, 0.2, 0.2],
      width - margin - rightMargin
    );
    yPosition -= sectionSpacing;

    // Ready-to-Use Copy
    if (yPosition < 250) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }

    page.drawText("Ready-to-Use Copy", {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight + 5;

    page.drawText("Website Hero:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    page.drawText(
      sanitizeText(`Headline: ${brandKit.readyToUseCopy.websiteHero.headline}`),
      {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      }
    );
    yPosition -= lineHeight;

    page.drawText(
      sanitizeText(`Subheadline: ${brandKit.readyToUseCopy.websiteHero.subheadline}`),
      {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      }
    );
    yPosition -= lineHeight + 5;

    page.drawText("About Us:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    yPosition = addText(
      brandKit.readyToUseCopy.aboutUs,
      margin + 10,
      yPosition,
      10,
      helveticaFont,
      [0.2, 0.2, 0.2],
      width - margin - 10 - rightMargin
    );
    yPosition -= lineHeight + 10;

    page.drawText("Social Bios:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    page.drawText(
      sanitizeText(`Instagram: ${brandKit.readyToUseCopy.socialBios.instagram}`),
      {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      }
    );
    yPosition -= lineHeight;

    page.drawText(
      sanitizeText(`Facebook: ${brandKit.readyToUseCopy.socialBios.facebook}`),
      {
        x: margin + 10,
        y: yPosition,
        size: 10,
        font: helveticaFont,
      }
    );
    yPosition -= lineHeight;

    page.drawText(sanitizeText(`X: ${brandKit.readyToUseCopy.socialBios.x}`), {
      x: margin + 10,
      y: yPosition,
      size: 10,
      font: helveticaFont,
    });
    yPosition -= lineHeight + 5;

    page.drawText("Email Signature:", {
      x: margin,
      y: yPosition,
      size: 11,
      font: helveticaBoldFont,
    });
    yPosition -= lineHeight;

    yPosition = addText(
      brandKit.readyToUseCopy.emailSignature,
      margin + 10,
      yPosition,
      10,
      helveticaFont,
      [0.2, 0.2, 0.2],
      width - margin - 10 - rightMargin
    );

    // Extras sections (only if they exist)
    if (brandKit.extras) {
      // Social Post Templates
      if (brandKit.extras.socialPostTemplates && brandKit.extras.socialPostTemplates.length > 0) {
        if (yPosition < 150) {
          page = pdfDoc.addPage([612, 792]);
          yPosition = height - 50;
        }
        yPosition -= sectionSpacing;
        page.drawText("Social Post Templates", {
          x: margin,
          y: yPosition,
          size: 14,
          font: helveticaBoldFont,
        });
        yPosition -= lineHeight + 5;
        for (const template of brandKit.extras.socialPostTemplates) {
          if (yPosition < 80) {
            page = pdfDoc.addPage([612, 792]);
            yPosition = height - 50;
          }
          yPosition = addText(
            template,
            margin + 10,
            yPosition,
            10,
            helveticaFont,
            [0.2, 0.2, 0.2],
            width - margin - 10 - rightMargin
          );
          yPosition -= lineHeight + 5;
        }
      }

      // FAQ Starter
      if (brandKit.extras.faqStarter && brandKit.extras.faqStarter.length > 0) {
        if (yPosition < 200) {
          page = pdfDoc.addPage([612, 792]);
          yPosition = height - 50;
        }
        yPosition -= sectionSpacing;
        page.drawText("FAQ Starter", {
          x: margin,
          y: yPosition,
          size: 14,
          font: helveticaBoldFont,
        });
        yPosition -= lineHeight + 5;
        for (const faq of brandKit.extras.faqStarter) {
          if (yPosition < 100) {
            page = pdfDoc.addPage([612, 792]);
            yPosition = height - 50;
          }
          page.drawText(sanitizeText(`Q: ${faq.question}`), {
            x: margin + 10,
            y: yPosition,
            size: 10,
            font: helveticaBoldFont,
          });
          yPosition -= lineHeight;
          yPosition = addText(
            faq.answer,
            margin + 10,
            yPosition,
            10,
            helveticaFont,
            [0.2, 0.2, 0.2],
            width - margin - 10 - rightMargin
          );
          yPosition -= lineHeight + 5;
        }
      }

      // Google Business Profile Description
      if (brandKit.extras.gbpDescription) {
        if (yPosition < 100) {
          page = pdfDoc.addPage([612, 792]);
          yPosition = height - 50;
        }
        yPosition -= sectionSpacing;
        page.drawText("Google Business Profile Description", {
          x: margin,
          y: yPosition,
          size: 14,
          font: helveticaBoldFont,
        });
        yPosition -= lineHeight + 5;
        yPosition = addText(
          brandKit.extras.gbpDescription,
          margin + 10,
          yPosition,
          10,
          helveticaFont,
          [0.2, 0.2, 0.2],
          width - margin - 10 - rightMargin
        );
      }

      // Meta Description
      if (brandKit.extras.metaDescription) {
        if (yPosition < 80) {
          page = pdfDoc.addPage([612, 792]);
          yPosition = height - 50;
        }
        yPosition -= sectionSpacing;
        page.drawText("Meta Description", {
          x: margin,
          y: yPosition,
          size: 14,
          font: helveticaBoldFont,
        });
        yPosition -= lineHeight + 5;
        page.drawText(sanitizeText(brandKit.extras.metaDescription), {
          x: margin + 10,
          y: yPosition,
          size: 10,
          font: helveticaFont,
        });
      }
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF with download headers
    const filename = `${brandKit.brandSummary.businessName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-brand-kit.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    console.error("[Brand Kit PDF] Error:", error);
    const isDev = process.env.NODE_ENV !== "production";
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Consistent error shape: { ok: false, error: string, requestId: string }
    // In dev only, include details field
    return NextResponse.json(
      {
        ok: false,
        error: isDev
          ? `Failed to generate PDF: ${errorMessage}`
          : "Failed to generate PDF. Please try again.",
        requestId,
        ...(isDev && error instanceof Error
          ? { details: { message: error.message, stack: error.stack } }
          : {}),
      },
      { status: 500 }
    );
  }
}


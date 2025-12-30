/**
 * Widget Script Endpoint
 * 
 * Returns a JavaScript snippet that injects the chat widget into the page.
 * GET /widget/ai-help-desk.js?businessId=...&key=...
 */

import { NextRequest } from "next/server";
import { validateWidgetKey } from "@/lib/api/widgetAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const key = searchParams.get("key");

    if (!businessId || !key) {
      return new Response(
        "// Error: businessId and key parameters are required",
        {
          status: 400,
          headers: { "Content-Type": "application/javascript" },
        }
      );
    }

    // Validate widget key
    const isValid = await validateWidgetKey(businessId, key);
    if (!isValid) {
      return new Response(
        "// Error: Invalid widget key",
        {
          status: 403,
          headers: { "Content-Type": "application/javascript" },
        }
      );
    }

    // Get widget settings
    const settings = await prisma.aiHelpDeskWidgetSettings.findUnique({
      where: { businessId },
    });

    if (!settings || !settings.enabled) {
      return new Response(
        "// Widget is disabled",
        {
          status: 403,
          headers: { "Content-Type": "application/javascript" },
        }
      );
    }

    // Get the base URL for the widget iframe
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    "http://localhost:3000");

    const greeting = settings.greeting || "Hi! How can I help you today?";
    const assistantAvatarUrl = settings.assistantAvatarUrl || null;
    const widgetUrl = `${baseUrl}/widget/ai-help-desk?businessId=${encodeURIComponent(businessId)}&key=${encodeURIComponent(key)}${greeting ? `&greeting=${encodeURIComponent(greeting)}` : ''}${assistantAvatarUrl ? `&avatar=${encodeURIComponent(assistantAvatarUrl)}` : ''}`;
    const brandColor = settings.brandColor || "#29c4a9";
    const position = settings.position || "bottom-right";
    const isLeft = position === "bottom-left";

    // Generate the widget script
    // Use initials fallback ("AI") when no avatar is set (businessName not available in widget script)
    const avatarButtonCode = assistantAvatarUrl
      ? `const buttonImg = document.createElement('img');
      buttonImg.src = '${assistantAvatarUrl}';
      buttonImg.alt = 'Chat assistant';
      buttonImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      buttonImg.onerror = function() {
        // Fallback to initials if image fails
        buttonImg.style.display = 'none';
        const initialsDiv = document.createElement('div');
        initialsDiv.textContent = 'AI';
        initialsDiv.style.cssText = 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(to bottom right, #29c4a9, #1ea085);color:white;font-weight:600;font-size:20px;';
        button.appendChild(initialsDiv);
      };
      button.appendChild(buttonImg);`
      : `const initialsDiv = document.createElement('div');
      initialsDiv.textContent = 'AI';
      initialsDiv.style.cssText = 'width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(to bottom right, #29c4a9, #1ea085);color:white;font-weight:600;font-size:20px;';
      button.appendChild(initialsDiv);`;

    const buttonBgColor = assistantAvatarUrl ? 'transparent' : 'transparent';

    const script = `
(function() {
  if (window.AIHelpDeskWidget) return; // Already loaded
  
  window.AIHelpDeskWidget = {
    init: function(config) {
      const iframe = document.createElement('iframe');
      iframe.id = 'ai-help-desk-widget';
      iframe.src = '${widgetUrl}';
      iframe.setAttribute('title', 'AI Help Desk Chat');
      iframe.setAttribute('aria-label', 'AI Help Desk Chat Widget');
      const iframePosition = ${isLeft ? "'left:20px;'" : "'right:20px;'"};
      iframe.style.cssText = 'position:fixed;bottom:20px;' + iframePosition + 'width:400px;height:600px;border:none;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:999999;display:none;';
      document.body.appendChild(iframe);
      
      const button = document.createElement('button');
      button.id = 'ai-help-desk-button';
      ${avatarButtonCode}
      button.setAttribute('aria-label', 'Open AI Help Desk Chat');
      button.setAttribute('type', 'button');
      const buttonPosition = ${isLeft ? "'left:20px;'" : "'right:20px;'"};
      button.style.cssText = 'position:fixed;bottom:20px;' + buttonPosition + 'width:60px;height:60px;border-radius:50%;border:none;background-color:${buttonBgColor};color:white;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:999998;transition:transform 0.2s;overflow:hidden;';
      button.onmouseover = function() { this.style.transform = 'scale(1.1)'; };
      button.onmouseout = function() { this.style.transform = 'scale(1)'; };
      button.onclick = function() {
        const iframe = document.getElementById('ai-help-desk-widget');
        if (iframe.style.display === 'none') {
          iframe.style.display = 'block';
          button.style.display = 'none';
        } else {
          iframe.style.display = 'none';
          button.style.display = 'block';
        }
      };
      document.body.appendChild(button);
      
      // Close button inside iframe (handled by widget UI)
      window.addEventListener('message', function(e) {
        if (e.data === 'ai-help-desk-close') {
          const iframe = document.getElementById('ai-help-desk-widget');
          const button = document.getElementById('ai-help-desk-button');
          if (iframe) iframe.style.display = 'none';
          if (button) button.style.display = 'block';
        }
      });
    }
  };
  
  // Auto-initialize with default config
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.AIHelpDeskWidget.init({});
    });
  } else {
    window.AIHelpDeskWidget.init({});
  }
})();
`.trim();

    return new Response(script, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Widget script error:", error);
    return new Response(
      "// Error: Failed to generate widget script",
      {
        status: 500,
        headers: { "Content-Type": "application/javascript" },
      }
    );
  }
}


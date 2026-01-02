/**
 * OBD Scheduler & Booking - Microsoft Graph Calendar Integration
 * 
 * OAuth 2.0 flow and getSchedule API for Microsoft 365/Outlook.
 * Read-only access to primary mailbox calendar.
 */

import { encrypt, decrypt } from "./encryption";
import { prisma } from "@/lib/prisma";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || "common";
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || (() => {
  if (process.env.NEXTAUTH_URL) return `${process.env.NEXTAUTH_URL}/api/obd-scheduler/calendar/callback/microsoft`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/obd-scheduler/calendar/callback/microsoft`;
  return "http://localhost:3000/api/obd-scheduler/calendar/callback/microsoft";
})();

const MICROSOFT_AUTH_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`;
const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
const MICROSOFT_GRAPH_API = "https://graph.microsoft.com/v1.0";

/**
 * Get Microsoft OAuth authorization URL
 */
export function getMicrosoftAuthUrl(state: string): string {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error("MICROSOFT_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    response_type: "code",
    scope: "Calendars.Read offline_access",
    response_mode: "query",
    state,
  });

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeMicrosoftCode(
  code: string,
  businessId: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date; accountEmail?: string }> {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft OAuth credentials are not configured");
  }

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      grant_type: "authorization_code",
      scope: "Calendars.Read offline_access",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft token exchange failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("Microsoft token exchange did not return access_token");
  }

  // Get user info to extract email
  let accountEmail: string | undefined;
  try {
    const userInfoResponse = await fetch(`${MICROSOFT_GRAPH_API}/me`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountEmail = userInfo.mail || userInfo.userPrincipalName;
    }
  } catch {
    // Ignore errors fetching user info
  }

  // Calculate expiration time (default to 1 hour if expires_in not provided)
  const expiresIn = data.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt,
    accountEmail,
  };
}

/**
 * Refresh Microsoft access token
 */
export async function refreshMicrosoftToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft OAuth credentials are not configured");
  }

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "Calendars.Read offline_access",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft token refresh failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("Microsoft token refresh did not return access_token");
  }

  const expiresIn = data.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Get free/busy intervals from Microsoft Graph using getSchedule
 */
export async function getMicrosoftFreeBusy(
  accessToken: string,
  timeMin: string, // ISO 8601
  timeMax: string  // ISO 8601
): Promise<Array<{ start: string; end: string }>> {
  // Get user's email/UPN first
  const userResponse = await fetch(`${MICROSOFT_GRAPH_API}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to get Microsoft user info");
  }

  const user = await userResponse.json();
  const userEmail = user.mail || user.userPrincipalName;

  // Use getSchedule API
  const response = await fetch(`${MICROSOFT_GRAPH_API}/me/calendar/getSchedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      schedules: [userEmail],
      startTime: {
        dateTime: timeMin,
        timeZone: "UTC",
      },
      endTime: {
        dateTime: timeMax,
        timeZone: "UTC",
      },
      availabilityViewInterval: 15, // 15-minute intervals
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Microsoft getSchedule API failed: ${error}`);
  }

  const data = await response.json();
  
  // Extract busy intervals from schedule
  const schedule = data.value?.[0];
  if (!schedule || !schedule.scheduleItems) {
    return [];
  }

  // Convert schedule items to busy intervals
  const busyIntervals: Array<{ start: string; end: string }> = [];
  
  for (const item of schedule.scheduleItems) {
    // Only include items that are busy (not free)
    if (item.status === "busy" || item.status === "tentative" || item.status === "oof" || item.status === "workingElsewhere") {
      if (item.start && item.end) {
        busyIntervals.push({
          start: item.start.dateTime,
          end: item.end.dateTime,
        });
      }
    }
  }

  return busyIntervals;
}

/**
 * Get or refresh Microsoft access token for a business
 * Updates stored tokens if refreshed
 */
export async function getMicrosoftAccessToken(businessId: string): Promise<string> {
  const connection = await prisma.schedulerCalendarConnection.findUnique({
    where: {
      businessId_provider: {
        businessId,
        provider: "microsoft",
      },
    },
  });

  if (!connection) {
    throw new Error("Microsoft calendar connection not found");
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date();
  const bufferTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  if (connection.expiresAt > bufferTime) {
    // Token is still valid
    return decrypt(connection.accessTokenEnc);
  }

  // Token expired, need to refresh
  if (!connection.refreshTokenEnc) {
    throw new Error("Refresh token not available for Microsoft calendar connection");
  }

  const refreshToken = decrypt(connection.refreshTokenEnc);
  const { accessToken, expiresAt } = await refreshMicrosoftToken(refreshToken);

  // Update stored tokens (encrypted)
  await prisma.schedulerCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEnc: encrypt(accessToken),
      expiresAt,
    },
  });

  return accessToken;
}


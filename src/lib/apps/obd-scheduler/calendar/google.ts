/**
 * OBD Scheduler & Booking - Google Calendar Integration
 * 
 * OAuth 2.0 flow and freeBusy API for Google Calendar.
 * Read-only access to primary calendar.
 */

import { encrypt, decrypt } from "./encryption";
import { prisma } from "@/lib/prisma";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || (() => {
  if (process.env.NEXTAUTH_URL) return `${process.env.NEXTAUTH_URL}/api/obd-scheduler/calendar/callback/google`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/obd-scheduler/calendar/callback/google`;
  return "http://localhost:3000/api/obd-scheduler/calendar/callback/google";
})();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Get Google OAuth authorization URL
 */
export function getGoogleAuthUrl(state: string): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent", // Force consent to get refresh token
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(
  code: string,
  businessId: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date; accountEmail?: string }> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("Google token exchange did not return access_token");
  }

  // Get user info to extract email
  let accountEmail: string | undefined;
  try {
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      accountEmail = userInfo.email;
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
 * Refresh Google access token
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token refresh failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("Google token refresh did not return access_token");
  }

  const expiresIn = data.expires_in || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Get free/busy intervals from Google Calendar
 */
export async function getGoogleFreeBusy(
  accessToken: string,
  timeMin: string, // ISO 8601
  timeMax: string  // ISO 8601
): Promise<Array<{ start: string; end: string }>> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }], // Primary calendar only in Phase 1
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google freeBusy API failed: ${error}`);
  }

  const data = await response.json();
  
  // Extract busy intervals from primary calendar
  const primaryCalendar = data.calendars?.primary;
  if (!primaryCalendar || !primaryCalendar.busy) {
    return [];
  }

  return primaryCalendar.busy.map((interval: { start: string; end: string }) => ({
    start: interval.start,
    end: interval.end,
  }));
}

/**
 * Get or refresh Google access token for a business
 * Updates stored tokens if refreshed
 */
export async function getGoogleAccessToken(businessId: string): Promise<string> {
  const connection = await prisma.schedulerCalendarConnection.findUnique({
    where: {
      businessId_provider: {
        businessId,
        provider: "google",
      },
    },
  });

  if (!connection) {
    throw new Error("Google calendar connection not found");
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
    throw new Error("Refresh token not available for Google calendar connection");
  }

  const refreshToken = decrypt(connection.refreshTokenEnc);
  const { accessToken, expiresAt } = await refreshGoogleToken(refreshToken);

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


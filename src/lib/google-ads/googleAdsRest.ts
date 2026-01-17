import { OAuth2Client } from "google-auth-library";

export type GoogleAdsApiVersion = `v${number}`;

export type GoogleAdsAuthConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type GoogleAdsRequestConfig = {
  developerToken: string;
  clientCustomerId: string; // account being queried
  loginCustomerId?: string; // optional MCC manager
  apiVersion?: GoogleAdsApiVersion; // default v20
};

export type GoogleAdsRequestErrorCode =
  | "LKRT_GOOGLE_ADS_AUTH_FAILED"
  | "LKRT_GOOGLE_ADS_REQUEST_FAILED"
  | "LKRT_GOOGLE_ADS_RESPONSE_INVALID"
  | "LKRT_GOOGLE_ADS_TIMEOUT";

export class GoogleAdsRequestError extends Error {
  code: GoogleAdsRequestErrorCode;
  httpStatus?: number;
  details?: unknown;

  constructor(args: { code: GoogleAdsRequestErrorCode; message: string; httpStatus?: number; details?: unknown }) {
    super(args.message);
    this.code = args.code;
    this.httpStatus = args.httpStatus;
    this.details = args.details;
  }
}

function digitsOnly(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const d = String(input).replace(/\D/g, "");
  return d || undefined;
}

export function getGoogleAdsConfigFromEnv(): {
  auth: GoogleAdsAuthConfig;
  req: GoogleAdsRequestConfig;
} {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientCustomerId = digitsOnly(process.env.GOOGLE_ADS_CLIENT_CUSTOMER_ID);
  const loginCustomerId = digitsOnly(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  if (!clientId || !clientSecret || !refreshToken || !developerToken || !clientCustomerId) {
    throw new GoogleAdsRequestError({
      code: "LKRT_GOOGLE_ADS_AUTH_FAILED",
      message:
        "Missing required Google Ads configuration (client id/secret, refresh token, developer token, customer id).",
    });
  }

  return {
    auth: { clientId, clientSecret, refreshToken },
    req: {
      developerToken,
      clientCustomerId,
      loginCustomerId,
      apiVersion: "v20",
    },
  };
}

export async function getGoogleAdsAccessToken(auth: GoogleAdsAuthConfig): Promise<string> {
  try {
    const oAuth2Client = new OAuth2Client(auth.clientId, auth.clientSecret);
    oAuth2Client.setCredentials({ refresh_token: auth.refreshToken });
    const tokenResponse = await oAuth2Client.getAccessToken();
    const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
    if (!token) {
      throw new GoogleAdsRequestError({
        code: "LKRT_GOOGLE_ADS_AUTH_FAILED",
        message: "Google Ads OAuth access token was empty.",
      });
    }
    return token;
  } catch (err) {
    throw new GoogleAdsRequestError({
      code: "LKRT_GOOGLE_ADS_AUTH_FAILED",
      message: "Failed to obtain Google Ads OAuth access token.",
      details: err,
    });
  }
}

export async function googleAdsFetchJson<T>(
  args: {
    accessToken: string;
    req: GoogleAdsRequestConfig;
    path: string; // must start with "/"
    body: unknown;
    timeoutMs?: number;
  }
): Promise<T> {
  const apiVersion = args.req.apiVersion || "v20";
  const url = `https://googleads.googleapis.com/${apiVersion}${args.path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.accessToken}`,
    "developer-token": args.req.developerToken,
    "Content-Type": "application/json",
  };

  // MCC support (optional)
  if (args.req.loginCustomerId) {
    headers["login-customer-id"] = args.req.loginCustomerId;
  }

  const controller = new AbortController();
  const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(args.body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort =
      (err instanceof DOMException && err.name === "AbortError") ||
      msg.toLowerCase().includes("abort");
    if (isAbort) {
      throw new GoogleAdsRequestError({
        code: "LKRT_GOOGLE_ADS_TIMEOUT",
        message: `Google Ads API request timed out after ${timeoutMs}ms for ${args.path}`,
        details: err,
      });
    }
    throw new GoogleAdsRequestError({
      code: "LKRT_GOOGLE_ADS_REQUEST_FAILED",
      message: `Google Ads API request failed (network) for ${args.path}`,
      details: err,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new GoogleAdsRequestError({
      code: "LKRT_GOOGLE_ADS_REQUEST_FAILED",
      message: `Google Ads API request failed (${res.status}) for ${args.path}`,
      httpStatus: res.status,
      details: json,
    });
  }

  return json as T;
}



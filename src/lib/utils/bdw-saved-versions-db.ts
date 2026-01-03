/**
 * Database-backed saved versions utility for Business Description Writer
 * 
 * Provides functions to interact with the DB API, with graceful fallback handling.
 * This is used alongside localStorage utilities (bdw-saved-versions.ts).
 */

import type { SavedVersion } from "./bdw-saved-versions";

export interface DbVersionResponse {
  id: string;
  createdAt: string;
  businessName: string;
  city: string;
  state: string;
  inputs: SavedVersion["inputs"];
  outputs: SavedVersion["outputs"];
  title: string;
}

export interface DbVersionsListResponse {
  versions: DbVersionResponse[];
}

export interface DbErrorResponse {
  ok: false;
  code: string;
  message: string;
}

/**
 * Fetch saved versions from the database
 * 
 * @param businessId - Business ID to fetch versions for
 * @returns Array of versions or throws error with code
 */
export async function fetchDbVersions(businessId: string): Promise<DbVersionResponse[]> {
  if (!businessId || !businessId.trim()) {
    throw new Error("Business ID is required");
  }

  const response = await fetch(
    `/api/business-description-writer/saved-versions?businessId=${encodeURIComponent(businessId.trim())}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const json = await response.json();

  if (!response.ok) {
    // Check for DB_UNAVAILABLE code
    if (json.code === "DB_UNAVAILABLE") {
      const error = new Error(json.message || "Database unavailable.") as Error & { code: string };
      error.code = "DB_UNAVAILABLE";
      throw error;
    }

    // If 500 error and message indicates missing table, normalize to DB_UNAVAILABLE
    if (response.status === 500 && json.message) {
      const message = json.message.toLowerCase();
      if (
        message.includes("does not exist") ||
        message.includes("relation") && message.includes("does not exist") ||
        message.includes("no such table") ||
        message.includes("table") && message.includes("does not exist")
      ) {
        const error = new Error("Database unavailable.") as Error & { code: string };
        error.code = "DB_UNAVAILABLE";
        throw error;
      }
    }

    // Other errors (401, 403, etc.)
    const error = new Error(json.message || "Failed to fetch versions") as Error & { code: string };
    error.code = json.code || "UNKNOWN_ERROR";
    throw error;
  }

  if (!json.ok || !json.data) {
    throw new Error("Invalid response from server");
  }

  const data = json.data as DbVersionsListResponse;
  return data.versions || [];
}

/**
 * Create a new saved version in the database
 * 
 * @param businessId - Business ID
 * @param version - Version data (without id and createdAt)
 * @returns Created version or throws error with code
 */
export async function createDbVersion(
  businessId: string,
  version: Omit<SavedVersion, "id" | "createdAt">
): Promise<DbVersionResponse> {
  if (!businessId || !businessId.trim()) {
    throw new Error("Business ID is required");
  }

  // Generate title from business name
  const title = `Business Description — ${version.businessName.trim() || "Business"}`;

  const response = await fetch("/api/business-description-writer/saved-versions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      businessId: businessId.trim(),
      title,
      businessName: version.businessName,
      city: version.city || null,
      state: version.state || null,
      inputs: version.inputs,
      outputs: version.outputs,
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    // Check for DB_UNAVAILABLE code
    if (json.code === "DB_UNAVAILABLE") {
      const error = new Error(json.message || "Database unavailable.") as Error & { code: string };
      error.code = "DB_UNAVAILABLE";
      throw error;
    }

    // If 500 error and message indicates missing table, normalize to DB_UNAVAILABLE
    if (response.status === 500 && json.message) {
      const message = json.message.toLowerCase();
      if (
        message.includes("does not exist") ||
        message.includes("relation") && message.includes("does not exist") ||
        message.includes("no such table") ||
        message.includes("table") && message.includes("does not exist")
      ) {
        const error = new Error("Database unavailable.") as Error & { code: string };
        error.code = "DB_UNAVAILABLE";
        throw error;
      }
    }

    // Other errors
    const error = new Error(json.message || "Failed to create version") as Error & { code: string };
    error.code = json.code || "UNKNOWN_ERROR";
    throw error;
  }

  if (!json.ok || !json.data) {
    throw new Error("Invalid response from server");
  }

  return json.data as DbVersionResponse;
}

/**
 * Delete a saved version from the database
 * 
 * @param businessId - Business ID
 * @param id - Version ID to delete
 * @returns Success boolean or throws error with code
 */
export async function deleteDbVersion(businessId: string, id: string): Promise<boolean> {
  if (!businessId || !businessId.trim()) {
    throw new Error("Business ID is required");
  }

  if (!id || !id.trim()) {
    throw new Error("Version ID is required");
  }

  const response = await fetch(
    `/api/business-description-writer/saved-versions?id=${encodeURIComponent(id.trim())}&businessId=${encodeURIComponent(businessId.trim())}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const json = await response.json();

  if (!response.ok) {
    // Check for DB_UNAVAILABLE code
    if (json.code === "DB_UNAVAILABLE") {
      const error = new Error(json.message || "Database unavailable.") as Error & { code: string };
      error.code = "DB_UNAVAILABLE";
      throw error;
    }

    // If 500 error and message indicates missing table, normalize to DB_UNAVAILABLE
    if (response.status === 500 && json.message) {
      const message = json.message.toLowerCase();
      if (
        message.includes("does not exist") ||
        message.includes("relation") && message.includes("does not exist") ||
        message.includes("no such table") ||
        message.includes("table") && message.includes("does not exist")
      ) {
        const error = new Error("Database unavailable.") as Error & { code: string };
        error.code = "DB_UNAVAILABLE";
        throw error;
      }
    }

    // Other errors
    const error = new Error(json.message || "Failed to delete version") as Error & { code: string };
    error.code = json.code || "UNKNOWN_ERROR";
    throw error;
  }

  return json.ok === true;
}


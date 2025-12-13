/**
 * OBD V3 App Framework - Shared Response Types
 * 
 * Base interfaces for all app API responses.
 * Each app can extend these interfaces with app-specific response fields.
 */

/**
 * Base error response structure
 */
export interface BaseErrorResponse {
  error: string;
  message?: string;
}

/**
 * Base success response wrapper
 */
export interface BaseSuccessResponse {
  success?: boolean;
  [key: string]: unknown;
}

/**
 * Conditional output item (e.g., FAQ items, Q&A boxes)
 */
export interface ConditionalOutputItem {
  question?: string;
  answer?: string;
  [key: string]: unknown;
}

/**
 * Base response structure that all apps can extend
 */
export interface BaseAppResponse extends BaseSuccessResponse {
  [key: string]: unknown;
}


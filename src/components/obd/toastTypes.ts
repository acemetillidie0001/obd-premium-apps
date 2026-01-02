/**
 * Shared toast type definitions for OBD components
 * 
 * Centralized type definitions to ensure consistency across all toast-related code.
 */

export type OBDToastType = "success" | "error" | "info" | "warning";

export type OBDToastItem = {
  id: string;
  type: OBDToastType;
  message: string;
  createdAt: number;
};


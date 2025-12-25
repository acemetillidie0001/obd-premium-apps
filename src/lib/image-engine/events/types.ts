/**
 * OBD Brand-Safe Image Generator - Event Taxonomy
 * 
 * Standardized event types for consistent logging and debugging.
 */

export type EngineEventType =
  | "decision"
  | "safety_decision"
  | "generate_start"
  | "provider_call"
  | "storage_write"
  | "generate_finish"
  | "error";

export interface EngineEventInput {
  requestId: string;
  type: EngineEventType;
  ok: boolean;
  messageSafe: string;
  data?: Record<string, unknown>;
}


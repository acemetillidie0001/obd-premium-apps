/**
 * Shared Handoff Types and Validators
 * 
 * Central export point for handoff system types and validators.
 * Used by both senders and receivers of handoff payloads.
 */

// Types
export type {
  WebDraftSectionType,
  WebDraftSection,
  WebDraftContent,
  WebDraftMeta,
  WebDraftPayload,
  HandoffPayload,
} from "./types";

export { isWebDraftPayload } from "./types";

// Validators
export {
  webDraftPayloadSchema,
  validateWebDraftPayload,
  isValidWebDraftPayload,
} from "./validators";

// Serializers
export {
  webDraftToMarkdown,
  webDraftToHtml,
} from "./serializers/webDraftSerializers";


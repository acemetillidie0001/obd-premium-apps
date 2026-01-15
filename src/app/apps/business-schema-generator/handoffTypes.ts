/**
 * Tier 5C — Schema Handoff Payload Contract (Receivers)
 *
 * Minimal, versioned payload for safe, additive imports into Business Schema Generator.
 * Sender apps are responsible for providing valid schema node fragments in `nodes`.
 */

export type SchemaHandoffPayload = {
  v: 1;
  source:
    | "ai-faq-generator"
    | "offers-promotions"
    | "event-campaign-builder"
    | "local-seo-page-builder";
  tenantId: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO (now + 10 min recommended)
  nodes: Record<string, unknown>[]; // schema nodes to add
};



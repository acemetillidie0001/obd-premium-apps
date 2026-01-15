import type {
  FAQItem,
  LocalSEOPageBuilderRequest,
  LocalSEOPageBuilderResponse,
  PageSections,
  SEOPack,
} from "./types";

export type LocalSEODraftStatus = "draft" | "generating" | "generated" | "edited" | "error";

export interface LocalSEOEdits {
  seoPack?: SEOPack;
  pageCopy?: string;
  faqs?: FAQItem[];
  pageSections?: PageSections;
  schemaJsonLd?: string;
}

export interface LocalSEOSourceInputs {
  form: LocalSEOPageBuilderRequest;
  lastPayload: LocalSEOPageBuilderRequest | null;
}

export interface LocalSEODraft {
  status: LocalSEODraftStatus;
  sourceInputs: LocalSEOSourceInputs;
  generated: LocalSEOPageBuilderResponse | null;
  edits: LocalSEOEdits;
  error: string | null;
}

export function hasEdits(edits: LocalSEOEdits): boolean {
  return (
    edits.pageCopy !== undefined ||
    edits.seoPack !== undefined ||
    edits.faqs !== undefined ||
    edits.pageSections !== undefined ||
    edits.schemaJsonLd !== undefined
  );
}

export function getActiveSeoPack(draft: LocalSEODraft): SEOPack | undefined {
  return draft.edits.seoPack ?? draft.generated?.seoPack;
}

export function getActivePageCopy(draft: LocalSEODraft): string {
  return draft.edits.pageCopy ?? draft.generated?.pageCopy ?? "";
}

export function getActiveFaqs(draft: LocalSEODraft): FAQItem[] {
  return draft.edits.faqs ?? draft.generated?.faqs ?? [];
}

export function getActivePageSections(draft: LocalSEODraft): PageSections | undefined {
  return draft.edits.pageSections ?? draft.generated?.pageSections;
}

export function getActiveSchemaJsonLd(draft: LocalSEODraft): string | undefined {
  return draft.edits.schemaJsonLd ?? draft.generated?.schemaJsonLd;
}



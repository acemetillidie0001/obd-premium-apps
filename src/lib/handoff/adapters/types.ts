import { WebDraftPayload } from "../types";

export interface CmsAdapter {
  id: "gutenberg" | "divi";
  label: string;
  description: string;
  generate(payload: WebDraftPayload): string;
}


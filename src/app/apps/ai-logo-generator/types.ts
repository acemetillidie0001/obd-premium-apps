export type PersonalityStyle = "Soft" | "Bold" | "High-Energy" | "Luxury" | "";

export type LogoStyle = "Modern" | "Classic" | "Minimalist" | "Vintage" | "Playful" | "Professional";

export interface LogoGeneratorRequest {
  businessName: string;
  businessType: string;
  services?: string;
  city?: string;
  state?: string;
  brandVoice?: string;
  personalityStyle?: PersonalityStyle;
  logoStyle?: LogoStyle;
  colorPreferences?: string;
  includeText?: boolean;
  variationsCount?: number;
  generateImages?: boolean;
}

export interface LogoConcept {
  id: number;
  description: string;
  styleNotes: string;
  colorPalette: string[];
  imageError?: string;
}

export interface LogoImage {
  id: number;
  conceptId: number;
  imageUrl: string | null;
  prompt: string;
  imageError?: string;
}

export interface LogoGeneratorResponseMeta {
  businessName: string;
  city: string;
  state: string;
  logoStyle: string;
  personalityStyle: string;
}

export interface LogoGeneratorResponse {
  concepts: LogoConcept[];
  images: LogoImage[];
  meta: LogoGeneratorResponseMeta;
}


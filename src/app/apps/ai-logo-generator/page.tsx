import type { LogoGeneratorRequest } from "./types";
import LogoGeneratorClient from "./LogoGeneratorClient";

const defaultFormValues: LogoGeneratorRequest = {
  businessName: "",
  businessType: "",
  services: "",
  city: "Ocala",
  state: "Florida",
  brandVoice: "",
  personalityStyle: "",
  logoStyle: "Modern",
  colorPreferences: "",
  includeText: true,
  variationsCount: 3,
  generateImages: false,
};

export default async function AILogoGeneratorPage() {
  // Refactor-only: keep initial defaults identical to the previous client page.
  return <LogoGeneratorClient initialDefaults={defaultFormValues} />;
}


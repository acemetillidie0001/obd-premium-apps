export type CmsImportTarget = "gutenberg" | "divi";

export function getCmsImportInstructions(target: CmsImportTarget): {
  title: string;
  bestFor: string;
  steps: string[];
  gotcha?: string;
} {
  switch (target) {
    case "gutenberg":
      return {
        title: "WordPress (Gutenberg) — Import Steps",
        bestFor: "Best when you want native WordPress blocks.",
        steps: [
          "Open the WordPress editor for your page or post.",
          "Open the options menu (⋮) and switch to Code editor.",
          "Paste the Gutenberg Blocks export.",
          "Switch back to Visual editor and review the blocks.",
          "Adjust formatting if needed, then save.",
        ],
        gotcha: "Use Code editor for pasting—Visual editor may not parse blocks correctly.",
      };

    case "divi":
      return {
        title: "Divi Builder — Import Steps",
        bestFor: "Best when building pages with Divi modules.",
        steps: [
          "Open the page in Divi Builder (Visual Builder).",
          "Add a module: Code (recommended) or Text.",
          "Paste the Divi HTML export into the module.",
          "Save the module and review layout.",
          "Optionally split content into multiple modules for spacing/sections.",
        ],
        gotcha: "Code module is usually more reliable for HTML than Text.",
      };

    default:
      const _exhaustive: never = target;
      throw new Error(`Unknown CMS import target: ${_exhaustive}`);
  }
}


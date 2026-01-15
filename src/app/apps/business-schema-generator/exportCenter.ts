export type ExportFormat = "jsonld" | "json-pretty" | "html-script";

export type ExportIssue = {
  level: "blocker" | "warning";
  code: string;
  message: string;
};

export type ExportPackage = {
  format: ExportFormat;
  label: string;
  filename: string;
  content: string;
  mime: string;
};

function parseActiveJson(
  activeJson: string
): { ok: true; value: unknown } | { ok: false; issue: ExportIssue } {
  const trimmed = activeJson.trim();
  if (!trimmed) {
    return {
      ok: false,
      issue: {
        level: "blocker",
        code: "EMPTY_ACTIVE_JSON",
        message: "Active schema JSON-LD is empty.",
      },
    };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return {
      ok: false,
      issue: {
        level: "blocker",
        code: "INVALID_JSON",
        message: "Active schema JSON-LD is not valid JSON.",
      },
    };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOwn(value: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

function hasNonEmptyType(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((v) => typeof v === "string" && v.trim().length > 0);
  return false;
}

function hasRootGraphType(graph: unknown): boolean {
  if (!Array.isArray(graph)) return false;
  for (const item of graph) {
    if (!isPlainObject(item)) continue;
    const t = getOwn(item, "@type");
    if (hasNonEmptyType(t)) return true;
  }
  return false;
}

function typeIncludes(typeValue: unknown, typeName: string): boolean {
  if (typeof typeValue === "string") return typeValue === typeName;
  if (Array.isArray(typeValue)) return typeValue.some((t) => typeof t === "string" && t === typeName);
  return false;
}

function extractCandidateNodes(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (isPlainObject(parsed)) {
    const graph = getOwn(parsed, "@graph");
    if (Array.isArray(graph)) return graph;
    return [parsed];
  }
  return [];
}

export function validateActiveSchemaJson(activeJson: string): ExportIssue[] {
  const parsed = parseActiveJson(activeJson);
  if (!parsed.ok) return [parsed.issue];

  const issues: ExportIssue[] = [];
  const v = parsed.value;

  const isObj = isPlainObject(v);
  const isArr = Array.isArray(v);
  if (!isObj && !isArr) {
    return [
      {
        level: "blocker",
        code: "NOT_OBJECT_OR_ARRAY",
        message: "Active schema JSON-LD must be a JSON object or array.",
      },
    ];
  }

  if (isObj && Object.keys(v).length === 0) {
    return [
      {
        level: "blocker",
        code: "EMPTY_OBJECT",
        message: "Active schema JSON-LD object is empty ({}).",
      },
    ];
  }

  if (isArr && v.length === 0) {
    return [
      {
        level: "blocker",
        code: "EMPTY_ARRAY",
        message: "Active schema JSON-LD array is empty ([]).",
      },
    ];
  }

  // Warnings (conservative; no heavy schema enforcement)
  if (isObj) {
    const ctx = getOwn(v, "@context");
    if (ctx === undefined) {
      issues.push({
        level: "warning",
        code: "MISSING_CONTEXT",
        message: 'JSON-LD object is missing "@context".',
      });
    }

    const type = getOwn(v, "@type");
    const graph = getOwn(v, "@graph");

    if (graph !== undefined && !Array.isArray(graph)) {
      issues.push({
        level: "warning",
        code: "GRAPH_NOT_ARRAY",
        message: 'JSON-LD "@graph" is present but is not an array.',
      });
    }

    if (Array.isArray(graph) && graph.length === 0) {
      issues.push({
        level: "blocker",
        code: "GRAPH_EMPTY",
        message: 'JSON-LD "@graph" array is empty.',
      });
    }

    const rootHasType = hasNonEmptyType(type);
    const graphHasType = graph !== undefined ? hasRootGraphType(graph) : false;
    if (!rootHasType && !graphHasType) {
      issues.push({
        level: "warning",
        code: "MISSING_TYPE",
        message: 'JSON-LD is missing "@type" (and no "@graph" item with a root "@type" was found).',
      });
    }
  }

  return issues;
}

export function buildJsonldExport(activeJson: string): ExportPackage {
  const content = `${activeJson.trim()}\n`;
  return {
    format: "jsonld",
    label: "Raw JSON-LD",
    filename: "schema.jsonld",
    content,
    mime: "application/ld+json",
  };
}

export function buildPrettyJsonExport(activeJson: string): ExportPackage {
  const parsed = parseActiveJson(activeJson);
  const value = parsed.ok ? parsed.value : null;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  return {
    format: "json-pretty",
    label: "Pretty JSON",
    filename: "schema.json",
    content,
    mime: "application/json",
  };
}

export function buildHtmlScriptExport(activeJson: string): ExportPackage {
  const pretty = buildPrettyJsonExport(activeJson).content.trimEnd();
  const content = `<script type="application/ld+json">\n${pretty}\n</script>\n`;
  return {
    format: "html-script",
    label: 'HTML <script type="application/ld+json">',
    filename: "schema.html",
    content,
    mime: "text/html",
  };
}

export function getExportIssues(activeJson: string): ExportIssue[] {
  return validateActiveSchemaJson(activeJson);
}

export function getExportPackages(activeJson: string): ExportPackage[] {
  const issues = validateActiveSchemaJson(activeJson);
  const hasBlocker = issues.some((i) => i.level === "blocker");
  if (hasBlocker) return [];

  return [
    buildJsonldExport(activeJson),
    buildPrettyJsonExport(activeJson),
    buildHtmlScriptExport(activeJson),
  ];
}

/**
 * Optional deterministic section exports (only if identifiable nodes exist already).
 * Derived strictly from the active schema bundle JSON-LD.
 */
export function getSectionExports(activeJson: string): ExportPackage[] {
  const issues = validateActiveSchemaJson(activeJson);
  const hasBlocker = issues.some((i) => i.level === "blocker");
  if (hasBlocker) return [];

  const parsed = parseActiveJson(activeJson);
  if (!parsed.ok) return [];

  const nodes = extractCandidateNodes(parsed.value);

  const findFirstByType = (typeName: string) => {
    for (const n of nodes) {
      if (!isPlainObject(n)) continue;
      const t = getOwn(n, "@type");
      if (typeIncludes(t, typeName)) return n;
    }
    return null;
  };

  const sectionPackages: ExportPackage[] = [];

  const faqPage = findFirstByType("FAQPage");
  if (faqPage) {
    sectionPackages.push({
      format: "jsonld",
      label: "FAQPage only",
      filename: "schema-faqpage.jsonld",
      content: `${JSON.stringify(faqPage, null, 2)}\n`,
      mime: "application/ld+json",
    });
  }

  const webPage = findFirstByType("WebPage");
  if (webPage) {
    sectionPackages.push({
      format: "jsonld",
      label: "WebPage only",
      filename: "schema-webpage.jsonld",
      content: `${JSON.stringify(webPage, null, 2)}\n`,
      mime: "application/ld+json",
    });
  }

  return sectionPackages;
}



import type { StyleSpecification } from "maplibre-gl";

export function normalizeMapStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) =>
      "filter" in layer && layer.filter
        ? { ...layer, filter: guardNullableNumericComparisons(layer.filter) as typeof layer.filter }
        : layer,
    ),
  };
}

function guardNullableNumericComparisons(expression: unknown): unknown {
  if (!Array.isArray(expression)) return expression;
  const children = expression.map(guardNullableNumericComparisons);
  const operator = children[0];
  if (!["<", "<=", ">", ">="].includes(String(operator))) return children;

  if (isGetExpression(children[1])) {
    const fallback =
      operator === "<" || operator === "<=" ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
    children[1] = ["coalesce", children[1], fallback];
  }
  if (isGetExpression(children[2])) {
    const fallback =
      operator === "<" || operator === "<=" ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    children[2] = ["coalesce", children[2], fallback];
  }
  return children;
}

function isGetExpression(value: unknown): value is unknown[] {
  return Array.isArray(value) && value[0] === "get";
}

export interface MapRuntimeDiagnostic {
  stage: "preflight" | "constructor" | "runtime" | "style-timeout" | "layer-setup";
  message: string;
  resourceType: "style" | "tile" | "sprite" | "glyph" | "worker" | "webgl" | "unknown";
  mapLoaded: boolean;
  styleLoaded: boolean;
  webglAvailable: boolean;
}

export function classifyMapError(message: string): MapRuntimeDiagnostic["resourceType"] {
  const normalized = message.toLowerCase();
  if (normalized.includes("webgl") || normalized.includes("canvas")) return "webgl";
  if (normalized.includes("worker") || normalized.includes("blob:")) return "worker";
  if (normalized.includes("sprite") || normalized.includes("image")) return "sprite";
  if (normalized.includes("glyph") || normalized.includes("font")) return "glyph";
  if (normalized.includes("tile") || normalized.includes("source")) return "tile";
  if (normalized.includes("style")) return "style";
  return "unknown";
}

export function sanitizeMapErrorMessage(message: string): string {
  return message
    .replace(/blob:[^\s"'<>]+/gi, "blob:[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}`;
      } catch {
        return "[invalid-url]";
      }
    });
}

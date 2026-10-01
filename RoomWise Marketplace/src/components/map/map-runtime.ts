import type { StyleSpecification } from "maplibre-gl";

const NULLABLE_REF_LENGTH_LAYERS = new Set([
  "highway-shield-non-us",
  "highway-shield-us-interstate",
  "road_shield_us",
]);

export function normalizeMapStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) =>
      NULLABLE_REF_LENGTH_LAYERS.has(layer.id) && "filter" in layer && layer.filter
        ? { ...layer, filter: guardNullableRefLength(layer.filter) as typeof layer.filter }
        : layer,
    ),
  };
}

function guardNullableRefLength(expression: unknown): unknown {
  if (!Array.isArray(expression)) return expression;
  if (
    expression[0] === "<=" &&
    Array.isArray(expression[1]) &&
    expression[1][0] === "get" &&
    expression[1][1] === "ref_length"
  ) {
    return ["<=", ["coalesce", expression[1], Number.MAX_SAFE_INTEGER], ...expression.slice(2)];
  }
  return expression.map(guardNullableRefLength);
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

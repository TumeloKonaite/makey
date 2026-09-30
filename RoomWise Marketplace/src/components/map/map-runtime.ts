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

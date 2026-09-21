import { AppConfig, DEFAULT_CONFIG } from "../simulation/types";

type AnyObj = Record<string, unknown>;

function isPlainObj(v: unknown): v is AnyObj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merges `src` into `dst` only for keys already present in dst. */
export function mergeInto<T extends AnyObj>(dst: T, src: unknown): T {
  if (!isPlainObj(src)) return dst;
  for (const k of Object.keys(dst)) {
    const sv = (src as AnyObj)[k];
    if (sv === undefined) continue;
    const dv = (dst as AnyObj)[k];
    if (isPlainObj(dv) && isPlainObj(sv)) {
      mergeInto(dv, sv);
    } else if (typeof dv === typeof sv) {
      (dst as AnyObj)[k] = sv;
    }
  }
  return dst;
}

export function cloneConfig(cfg: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(cfg)) as AppConfig;
}

export function configFromJSON(json: string): AppConfig | null {
  try {
    const parsed: unknown = JSON.parse(json);
    const cfg = cloneConfig(DEFAULT_CONFIG);
    mergeInto(cfg as unknown as AnyObj, parsed);
    return cfg;
  } catch {
    return null;
  }
}

export function configToHash(cfg: AppConfig): string {
  return "#c=" + encodeURIComponent(JSON.stringify(cfg));
}

export function configFromHash(hash: string): AppConfig | null {
  if (!hash.startsWith("#c=")) return null;
  return configFromJSON(decodeURIComponent(hash.slice(3)));
}

export function downloadJSON(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(name: string, text: string, mime = "text/csv"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

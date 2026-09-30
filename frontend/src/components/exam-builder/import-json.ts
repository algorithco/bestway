import type { MockImportIssue } from "@/lib/types";

/**
 * Client-side helpers for the Import JSON flow. These never touch auth state:
 * the browser session stays in the HttpOnly cookie and every server call goes
 * through `/api/backend/*` via the shared `api` client.
 */

export const IMPORT_PACKAGE_MAX_BYTES = 2 * 1024 * 1024;

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: string };

/** Parse pasted/file JSON with an explicit size guard (server enforces 2 MiB too). */
export function parsePackageInput(text: string): ParseResult {
  if (new TextEncoder().encode(text).length > IMPORT_PACKAGE_MAX_BYTES) {
    return { ok: false, error: "too-large" };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "invalid-json" };
  }
}

/**
 * Scan raw JSON text for duplicate object keys (`JSON.parse` keeps only the
 * last one). Mirrors the server check so teachers get instant feedback.
 */
export function findDuplicateKeys(raw: string): string[] {
  const dups: string[] = [];
  const stack: Array<{ keys: Set<string>; path: string }> = [];
  let i = 0;
  const pushPath = (key: string) => {
    const top = stack[stack.length - 1];
    const esc = key.replace(/~/g, "~0").replace(/\//g, "~1");
    return top ? `${top.path}/${esc}` : `/${esc}`;
  };
  const readString = (): string => {
    let out = "";
    i++;
    while (i < raw.length) {
      const ch = raw[i];
      if (ch === "\\") {
        out += raw[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        break;
      }
      out += ch;
      i++;
    }
    return out;
  };
  const skipWs = () => {
    while (i < raw.length && /\s/.test(raw[i])) i++;
  };
  let pendingKey: string | null = null;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"') {
      const s = readString();
      skipWs();
      if (raw[i] === ":") {
        pendingKey = s;
        const top = stack[stack.length - 1];
        if (top) {
          if (top.keys.has(s)) dups.push(pushPath(s));
          else top.keys.add(s);
        }
      } else {
        pendingKey = null;
      }
      continue;
    }
    if (ch === "{") {
      const base =
        pendingKey != null ? pushPath(pendingKey) : stack.length ? stack[stack.length - 1].path : "";
      stack.push({ keys: new Set(), path: base });
      pendingKey = null;
      i++;
      continue;
    }
    if (ch === "}") {
      stack.pop();
      pendingKey = null;
      i++;
      continue;
    }
    if (ch === "[" || ch === "]") {
      pendingKey = null;
      i++;
      continue;
    }
    i++;
  }
  return dups;
}

export interface MediaDeclaration {
  key: string;
  kind: string;
  fileName: string;
  requiredForPublish: boolean;
}

/** Declared media keys for the binding step (safe extraction from user JSON). */
export function extractMediaDeclarations(pkg: unknown): MediaDeclaration[] {
  if (typeof pkg !== "object" || pkg === null || Array.isArray(pkg)) return [];
  const media = (pkg as Record<string, unknown>).media;
  if (!Array.isArray(media)) return [];
  const out: MediaDeclaration[] = [];
  for (const m of media) {
    if (typeof m !== "object" || m === null) continue;
    const r = m as Record<string, unknown>;
    if (typeof r.key !== "string" || typeof r.kind !== "string" || typeof r.fileName !== "string") {
      continue;
    }
    out.push({
      key: r.key,
      kind: r.kind,
      fileName: r.fileName,
      requiredForPublish: r.requiredForPublish === true,
    });
  }
  return out;
}

/** Split a dry-run report into import vs publish blockers (deterministic order kept). */
export function groupImportIssues(issues: MockImportIssue[]): {
  importBlocking: MockImportIssue[];
  publishBlocking: MockImportIssue[];
} {
  return {
    importBlocking: issues.filter((i) => i.blocks.includes("import")),
    publishBlocking: issues.filter((i) => !i.blocks.includes("import") && i.blocks.includes("publish")),
  };
}

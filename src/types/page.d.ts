import type { AceEntry } from "./entries";

/** What to do with a request for a page: show an entry, redirect, or explain. */
export type AcePage<Values = Record<string, unknown>> =
  | { kind: "entry"; status: 200; entry: AceEntry<Values>; headers: Record<string, string> }
  | { kind: "redirect"; status: 301 | 302; location: string; headers: Record<string, string> }
  | { kind: "not-found"; status: 404; headers: Record<string, string> }
  | { kind: "unavailable"; status: 503; headers: Record<string, string> }
  | { kind: "preview-expired"; status: 403; headers: Record<string, string> };

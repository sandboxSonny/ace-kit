import type { SectionTypesPayload } from "./payload";

/** What syncing section types to the CMS came to. */
export type SyncOutcome =
  | {
      kind: "synced";
      site: { id: number; domain: string };
      /** The site's section types as they now are, retired ones included (marked). */
      sections: { handle: string; name: string; retired: boolean }[];
      /** Things the person should know, such as a change the CMS did not make. */
      warnings: string[];
    }
  | { kind: "login-ended" }
  | { kind: "site-not-found"; domain: string; available: string[] }
  | { kind: "forbidden"; message: string }
  | { kind: "rejected"; message: string }
  | { kind: "unreachable" };

const requestTimeoutMilliseconds = 20_000;

async function readMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Nothing to read.
  }
  return fallback;
}

/**
 * Sends the section types a site's code defines to the CMS, for the site with this domain. The list is the whole
 * list: anything the CMS has that isn't in it is retired there (kept, hidden), so only call this with every
 * definition the site has.
 */
export async function syncSectionTypes(options: {
  apiUrl: string;
  siteDomain: string;
  token: string;
  payload: SectionTypesPayload;
  fetchImplementation: typeof fetch;
}): Promise<SyncOutcome> {
  const { apiUrl, siteDomain, token, payload, fetchImplementation } = options;
  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };

  let sitesResponse: Response;
  try {
    sitesResponse = await fetchImplementation(`${apiUrl}/sites`, {
      headers,
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
  } catch {
    return { kind: "unreachable" };
  }
  if (sitesResponse.status === 401) return { kind: "login-ended" };
  if (!sitesResponse.ok)
    return {
      kind: "rejected",
      message: await readMessage(sitesResponse, `The CMS answered with an error (${sitesResponse.status}).`),
    };

  const sites = (await sitesResponse.json().catch(() => [])) as { id: number; domain: string }[];
  const wanted = siteDomain.trim().toLowerCase();
  const site = sites.find((candidate) => candidate.domain.toLowerCase() === wanted);
  if (!site)
    return { kind: "site-not-found", domain: siteDomain, available: sites.map((candidate) => candidate.domain) };

  let response: Response;
  try {
    response = await fetchImplementation(`${apiUrl}/sites/${site.id}/section-types`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
  } catch {
    return { kind: "unreachable" };
  }
  if (response.status === 401) return { kind: "login-ended" };
  if (response.status === 403) {
    return {
      kind: "forbidden",
      message: "Your account can't change this site's sections: only a site's owners and super admins can.",
    };
  }
  if (!response.ok)
    return {
      kind: "rejected",
      message: await readMessage(response, `The CMS answered with an error (${response.status}).`),
    };

  const body = (await response.json().catch(() => null)) as {
    sections?: { handle: string; name: string; retired_at?: string }[];
    warnings?: string[];
  } | null;
  return {
    kind: "synced",
    site: { id: site.id, domain: site.domain },
    sections: (body?.sections ?? []).map((section) => ({
      handle: section.handle,
      name: section.name,
      retired: section.retired_at !== undefined,
    })),
    warnings: body?.warnings ?? [],
  };
}

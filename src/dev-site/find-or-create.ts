/** The dev site: a private copy of a site in the CMS that one developer builds against. */
export type DevSite = { id: number; name: string; domain: string };

/** What asking the CMS for the developer's dev site came to. */
export type DevSiteOutcome =
  | { kind: "created"; site: DevSite }
  | { kind: "found"; site: DevSite }
  | { kind: "login-ended" }
  | { kind: "site-not-found"; domain: string; available: string[] }
  | { kind: "forbidden"; message: string }
  | { kind: "rejected"; message: string }
  | { kind: "unreachable" };

type ListedSite = { id: number; name: string; domain: string; kind?: string };

const requestTimeoutMilliseconds = 60_000;

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
 * Finds the developer's own dev site of the site with this domain, asking the CMS to make it (as a copy of the site)
 * if they have none yet. If the domain is already a dev site's, that one is used. `previewUrl`, if given, is saved
 * as the address the dev site is edited at (not when the domain was already a dev site's).
 */
export async function findOrCreateDevSite(options: {
  apiUrl: string;
  siteDomain: string;
  token: string;
  previewUrl?: string;
  fetchImplementation: typeof fetch;
}): Promise<DevSiteOutcome> {
  const { apiUrl, siteDomain, token, previewUrl, fetchImplementation } = options;
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
  if (!sitesResponse.ok) {
    return {
      kind: "rejected",
      message: await readMessage(sitesResponse, `The CMS answered with an error (${sitesResponse.status}).`),
    };
  }

  const sites = (await sitesResponse.json().catch(() => [])) as ListedSite[];
  const wanted = siteDomain.trim().toLowerCase();
  const site = sites.find((candidate) => candidate.domain.toLowerCase() === wanted);
  if (!site) {
    return {
      kind: "site-not-found",
      domain: siteDomain,
      available: sites.filter((candidate) => candidate.kind !== "dev").map((candidate) => candidate.domain),
    };
  }
  // Already a dev site (the process was pointed at it earlier): nothing to make.
  if (site.kind === "dev") return { kind: "found", site };

  let response: Response;
  try {
    response = await fetchImplementation(`${apiUrl}/sites/${site.id}/dev-site`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: previewUrl === undefined ? undefined : JSON.stringify({ preview_url: previewUrl }),
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
  } catch {
    return { kind: "unreachable" };
  }
  if (response.status === 401) return { kind: "login-ended" };
  if (response.status === 403) {
    return {
      kind: "forbidden",
      message: await readMessage(response, "Your account can't have a dev site of this site."),
    };
  }
  if (!response.ok) {
    return {
      kind: "rejected",
      message: await readMessage(response, `The CMS answered with an error (${response.status}).`),
    };
  }

  const made = (await response.json().catch(() => null)) as DevSite | null;
  if (!made || typeof made.id !== "number" || typeof made.domain !== "string") {
    return { kind: "rejected", message: "The CMS sent an unexpected reply." };
  }
  return {
    kind: response.status === 201 ? "created" : "found",
    site: { id: made.id, name: made.name, domain: made.domain },
  };
}

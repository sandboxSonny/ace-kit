import type { Framework } from "./create-site";
import { frameworksWithSections, pageFields, starterEntries } from "./starter-content";

const requestTimeoutMilliseconds = 60_000;

/** How making the site in the CMS came out. */
export type SeedOutcome =
  | { kind: "exists"; name: string }
  | { kind: "seeded"; siteId: number; entries: number }
  /** `siteMade` says whether the site was made before it went wrong, so it is left half set up. */
  | { kind: "failed"; message: string; siteMade: boolean };

/** The CMS answered with an error, or couldn't be reached. */
class CmsError extends Error {}

type Component = { id: number; key: string };
type ListedSite = { id: number; name: string; domain: string; kind?: string };

/**
 * Makes a new site in the CMS and gives it a starter: a `pages` content type, Home, About and Contact entries, a main
 * menu and (for a starter that draws them) the section types. If the person can already see a site with this domain
 * nothing is changed: that site is theirs, and may have real content in it.
 */
export async function createAndSeedSite(options: {
  apiUrl: string;
  token: string;
  name: string;
  domain: string;
  /** Where the site is seen while editing, when that isn't https://<domain> (a site run on this machine). */
  previewUrl?: string;
  framework: Framework;
  /** The body of `PUT /sites/{id}/section-types` for the starter's sections. */
  sectionTypes: unknown;
  fetchImplementation: typeof fetch;
}): Promise<SeedOutcome> {
  const { apiUrl, token, name, domain, framework, fetchImplementation } = options;

  async function request<Reply>(method: string, path: string, body?: unknown): Promise<Reply> {
    let response: Response;
    try {
      response = await fetchImplementation(`${apiUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
    } catch (error) {
      // The reason (a refused connection, a bad certificate, a header that isn't allowed) is what tells you what to fix.
      const cause = (error as { cause?: { code?: string; message?: string } }).cause;
      const reason = cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : String(error));
      throw new CmsError(`Could not reach the CMS at ${apiUrl} (${reason}).`);
    }
    const text = await response.text();
    let reply: unknown = null;
    try {
      reply = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON: the status says enough.
    }
    if (response.status === 401) throw new CmsError("The login has ended. Run: npx ace-kit login");
    if (!response.ok) {
      const message = (reply as { error?: unknown } | null)?.error;
      // What the CMS says is shown as text only: control characters (terminal escape codes) are dropped.
      const readable = typeof message === "string" ? message.replace(/\p{Cc}/gu, "").slice(0, 300) : "";
      throw new CmsError(readable || `The CMS answered with an error (${response.status}).`);
    }
    return reply as Reply;
  }

  let siteMade = false;
  try {
    const sites = await request<ListedSite[]>("GET", "/sites");
    const existing = sites.find((site) => site.kind !== "dev" && site.domain.toLowerCase() === domain);
    if (existing) return { kind: "exists", name: existing.name };

    const site = await request<{ id: number }>("POST", "/sites", {
      name,
      domain,
      ...(options.previewUrl && { preview_url: options.previewUrl }),
    });
    siteMade = true;
    const sitePath = `/sites/${site.id}`;

    // Section types come first: entries that use a section can't be saved until the section exists.
    if (frameworksWithSections.includes(framework))
      await request("PUT", `${sitePath}/section-types`, options.sectionTypes);

    const components = await request<Component[]>("GET", "/components");
    const fields = pageFields(framework).map(({ componentKey, label, handle, config }) => {
      const component = components.find((candidate) => candidate.key === componentKey);
      if (!component) throw new CmsError(`The CMS has no "${componentKey}" field type.`);
      return { component_id: component.id, label, handle, config };
    });
    const pagesType = await request<{ id: number }>("POST", `${sitePath}/content-types`, {
      name: "Pages",
      handle: "pages",
      fields,
    });

    const entryIds: Record<string, number> = {};
    for (const entry of starterEntries(framework, name)) {
      const values = Object.fromEntries(
        Object.entries(entry.values).map(([handle, value]) => [
          handle,
          typeof value === "function" ? (value as (ids: Record<string, number>) => unknown)(entryIds) : value,
        ]),
      );
      const created = await request<{ id: number }>("POST", `${sitePath}/entries`, {
        content_type_id: pagesType.id,
        handle: entry.handle,
        title: entry.title,
        description: entry.description,
        values,
      });
      entryIds[entry.handle] = created.id;
    }

    const link = (label: string, handle: string) => ({
      label,
      kind: "entry",
      entry_id: entryIds[handle],
      children: [],
    });
    await request("POST", `${sitePath}/menus`, {
      name: "Main menu",
      handle: "main-menu",
      items: [link("Home", "home"), link("About", "about"), link("Contact", "contact")],
    });
    return { kind: "seeded", siteId: site.id, entries: Object.keys(entryIds).length };
  } catch (error) {
    if (error instanceof CmsError) return { kind: "failed", message: error.message, siteMade };
    throw error;
  }
}

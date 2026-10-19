import { putToSite } from "../sections/sync";
import type { SiteSendOutcome } from "../sections/sync";
import type { FormsPayload } from "./payload";

/** What syncing forms to the CMS came to. */
export type FormSyncOutcome =
  | {
      kind: "synced";
      site: { id: number; domain: string };
      /** The site's forms as they now are, retired ones included (marked). */
      forms: { handle: string; name: string; retired: boolean }[];
    }
  | Exclude<SiteSendOutcome, { kind: "done" }>;

/**
 * Sends the forms a site's code defines to the CMS, for the site with this domain. The list is the whole list: a form
 * the CMS has that isn't in it is retired there (kept with its messages, but taking no new ones). Who is emailed and
 * the thank-you message are the owners' and are never changed by a sync.
 */
export async function syncForms(options: {
  apiUrl: string;
  siteDomain: string;
  token: string;
  payload: FormsPayload;
  fetchImplementation: typeof fetch;
}): Promise<FormSyncOutcome> {
  const sent = await putToSite({
    apiUrl: options.apiUrl,
    siteDomain: options.siteDomain,
    token: options.token,
    path: "/forms",
    body: options.payload,
    forbiddenMessage: "Your account can't change this site's forms: only a site's owners and super admins can.",
    fetchImplementation: options.fetchImplementation,
  });
  if (sent.kind !== "done") return sent;
  const body = sent.body as { forms?: { handle: string; name: string; retired_at?: string }[] } | null;
  return {
    kind: "synced",
    site: sent.site,
    forms: (body?.forms ?? []).map((form) => ({
      handle: form.handle,
      name: form.name,
      retired: form.retired_at !== undefined,
    })),
  };
}

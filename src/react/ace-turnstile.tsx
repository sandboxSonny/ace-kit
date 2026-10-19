type AceTurnstileProps = {
  /** The form's Turnstile site key (`turnstile_site_key` of `getForm`). An empty key draws nothing. */
  siteKey: string | undefined;
};

/**
 * The Cloudflare Turnstile widget for a form, inside the form. It adds a hidden `cf-turnstile-response` field that
 * `getFormSubmitResponse` and `createFormAction` read. With no site key (the owners have not turned Turnstile on) it
 * draws nothing. The script is loaded where the widget is drawn.
 */
export function AceTurnstile({ siteKey }: AceTurnstileProps) {
  if (!siteKey) return null;
  return (
    <>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={siteKey} />
    </>
  );
}

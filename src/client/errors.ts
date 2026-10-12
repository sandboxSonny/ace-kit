/** The preview link the editor opened has run out. Reload the editor for a new one. */
export class AcePreviewExpiredError extends Error {
  constructor() {
    super("The preview link has expired.");
    this.name = "AcePreviewExpiredError";
  }
}

/** The CMS could not be reached, or answered with something unexpected. */
export class AceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AceUnavailableError";
  }
}

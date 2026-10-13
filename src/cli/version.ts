declare const __ACE_KIT_VERSION__: string | undefined;

/** The version of this package, put into the built tool when it is built (and "development" when it is run from source). */
export const aceKitVersion: string = typeof __ACE_KIT_VERSION__ === "string" ? __ACE_KIT_VERSION__ : "development";

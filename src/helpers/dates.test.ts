import { describe, expect, it } from "vitest";

import { formatAceDate } from "./dates";

describe("formatAceDate", () => {
  it("writes the day in words, in the language asked for", () => {
    expect(formatAceDate("2026-10-13", { locale: "en-GB" })).toBe("13 October 2026");
    expect(formatAceDate("2026-10-13", { locale: "en-US" })).toBe("October 13, 2026");
    expect(formatAceDate("2026-10-13", { locale: "fr-FR" })).toBe("13 octobre 2026");
  });

  it("takes the format options of Intl.DateTimeFormat", () => {
    expect(formatAceDate("2026-10-03", { locale: "en-GB", day: "numeric", month: "short" })).toBe("3 Oct");
    expect(formatAceDate("2026-10-03", { locale: "en-GB", dateStyle: "short" })).toBe("03/10/2026");
  });

  it("never shifts the day with the time zone of the server", () => {
    const original = process.env.TZ;
    try {
      for (const zone of ["Pacific/Kiritimati", "UTC", "America/Los_Angeles", "Pacific/Pago_Pago"]) {
        process.env.TZ = zone;
        expect(formatAceDate("2026-01-01", { locale: "en-GB" }), zone).toBe("1 January 2026");
        expect(formatAceDate("2026-12-31", { locale: "en-GB" }), zone).toBe("31 December 2026");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it("accepts a leap day only in a leap year", () => {
    expect(formatAceDate("2028-02-29", { locale: "en-GB" })).toBe("29 February 2028");
    expect(formatAceDate("2027-02-29")).toBeNull();
  });

  it.each([
    "",
    "2026-10",
    "2026-1-5",
    "13/10/2026",
    "2026-10-13T09:00:00Z",
    "2026-13-01",
    "2026-04-31",
    "2026-00-10",
    "not a date",
    " 2026-10-13",
  ])("gives nothing for %j", (text) => {
    expect(formatAceDate(text)).toBeNull();
  });
});

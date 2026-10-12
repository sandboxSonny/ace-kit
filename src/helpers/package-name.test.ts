import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { packageName } from "./package-name";

describe("packageName", () => {
  it("is the name package.json publishes under, which generated types augment", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      name: string;
    };
    expect(packageName).toBe(manifest.name);
  });
});

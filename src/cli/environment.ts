import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { pathToFileURL } from "node:url";

import { chooseLoginStore } from "../auth/choose-store";
import { createLastApiUrl, defaultLastApiUrlFile } from "../auth/last-api-url";
import type { LastApiUrl } from "../auth/last-api-url";
import type { CommandRunner } from "../auth/keychain-store";
import type { LoginStore } from "../auth/login-store";
import { aceKitVersion } from "./version";

/** Everything the command line tool touches in the world, so tests can stand in for it. */
export type CliEnvironment = {
  /** Settings: the environment, plus anything in a .env file in the folder the command runs in. */
  variables: Record<string, string | undefined>;
  platform: NodeJS.Platform;
  hostname: string;
  version: string;
  out: (text: string) => void;
  error: (text: string) => void;
  fetchImplementation: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
  /** The folder the command runs in: where a site's own files are. */
  workingDirectory: string;
  /** Loads a JavaScript or TypeScript file the site wrote and returns its exports. */
  importModule: (path: string) => Promise<unknown>;
  /** Opens a web page in the person's browser, if it can. */
  openBrowser: (address: string) => Promise<void>;
  /** Where logins are kept between commands. */
  store: LoginStore;
  /** The API address last signed in to, used when no address is given. */
  lastApiUrl: LastApiUrl;
};

/** Runs a program, writing `input` to its standard input, and reports how it ended. */
export const runCommand: CommandRunner = (command, commandArguments, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArguments, { stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stdout }));
    child.stdin.on("error", () => {
      // The program ended before reading its input; its exit code says how it went.
    });
    child.stdin.end(input ?? "");
  });

/** How to open a web page on each system. Only web addresses are ever passed. */
export function browserCommand(
  platform: NodeJS.Platform,
  address: string,
): { command: string; commandArguments: string[] } {
  if (platform === "darwin") return { command: "open", commandArguments: [address] };
  // Not `cmd /c start`: cmd reads characters such as & in an address as commands of its own.
  if (platform === "win32") return { command: "rundll32", commandArguments: ["url.dll,FileProtocolHandler", address] };
  return { command: "xdg-open", commandArguments: [address] };
}

async function openBrowser(platform: NodeJS.Platform, address: string): Promise<void> {
  const { command, commandArguments } = browserCommand(platform, address);
  await new Promise<void>((resolve) => {
    // Failing to open a browser is fine: the address is printed too.
    const child = spawn(command, commandArguments, { stdio: "ignore", detached: true });
    child.on("error", () => resolve());
    child.on("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

/**
 * Loads one of the site's own files. TypeScript runs as it is on Node 22.18 and newer, which is why a schema file may
 * be a .ts file; on an older Node the error says so.
 */
async function importModule(path: string): Promise<unknown> {
  try {
    return await import(pathToFileURL(path).href);
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_UNKNOWN_FILE_EXTENSION") {
      throw new Error(
        "this version of Node can't run TypeScript files. Use Node 22.18 or newer, or write the schema in .js.",
      );
    }
    throw error;
  }
}

/** The real thing: the process's own settings, console, clock, network and keychain. */
export async function createRealEnvironment(): Promise<CliEnvironment> {
  // Settings may be in a .env file in the folder the command runs in (variables already set win).
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: the environment and the options are enough.
  }
  const variables = { ...process.env };
  const platform = process.platform;
  return {
    variables,
    platform,
    hostname: hostname(),
    version: aceKitVersion,
    out: (text) => process.stdout.write(`${text}\n`),
    error: (text) => console.error(text),
    fetchImplementation: (input, init) => fetch(input, init),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now: Date.now,
    workingDirectory: process.cwd(),
    importModule,
    openBrowser: (address) => openBrowser(platform, address),
    store: await chooseLoginStore({ platform, variables, run: runCommand }),
    lastApiUrl: createLastApiUrl(defaultLastApiUrlFile(variables, platform)),
  };
}

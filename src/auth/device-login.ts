import type { StoredLogin } from "./login-store";

/** Why a login did not happen, in terms the person can act on. */
export class DeviceLoginError extends Error {
  readonly reason: "denied" | "expired" | "unavailable" | "unsupported";

  constructor(reason: DeviceLoginError["reason"], message: string) {
    super(message);
    this.name = "DeviceLoginError";
    this.reason = reason;
  }
}

/** What the CMS gives a tool that asks to be signed in. */
export type DeviceLoginRequest = {
  /** The tool's secret. Never shown. */
  deviceCode: string;
  /** The short code to show the person, such as BCDF-GHJK. */
  userCode: string;
  /** The admin app's page where the person types the code. */
  verificationUri: string;
  expiresInSeconds: number;
  intervalSeconds: number;
};

type Dependencies = {
  fetchImplementation: typeof fetch;
};

const requestTimeoutMilliseconds = 15_000;
/** How many requests in a row may fail before the login is given up on. */
const maximumFailures = 5;

async function post(dependencies: Dependencies, apiUrl: string, path: string, body: unknown): Promise<Response> {
  return dependencies.fetchImplementation(`${apiUrl}${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(requestTimeoutMilliseconds),
  });
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // No message to read.
  }
  return `The CMS answered with an error (${response.status}).`;
}

/** Asks the CMS to start a login for this tool. `clientName` says which tool and machine, for the person approving. */
export async function startDeviceLogin(
  dependencies: Dependencies & { apiUrl: string; clientName: string },
): Promise<DeviceLoginRequest> {
  let response: Response;
  try {
    response = await post(dependencies, dependencies.apiUrl, "/auth/device", { client_name: dependencies.clientName });
  } catch {
    throw new DeviceLoginError("unavailable", `Could not reach the CMS at ${dependencies.apiUrl}.`);
  }
  if (response.status === 503) throw new DeviceLoginError("unsupported", await readMessage(response));
  if (response.status === 429)
    throw new DeviceLoginError("unavailable", "Too many attempts. Wait a minute and try again.");
  if (response.status === 404) {
    throw new DeviceLoginError(
      "unsupported",
      `${dependencies.apiUrl} does not offer command-line sign-in. Is it a CMS Ace API, and is it up to date?`,
    );
  }
  if (!response.ok) throw new DeviceLoginError("unavailable", await readMessage(response));

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const { device_code, user_code, verification_uri, expires_in, interval } = body ?? {};
  if (
    typeof device_code !== "string" ||
    typeof user_code !== "string" ||
    typeof verification_uri !== "string" ||
    typeof expires_in !== "number" ||
    typeof interval !== "number"
  ) {
    throw new DeviceLoginError(
      "unavailable",
      "The CMS sent a reply this version of ace-kit can't read. Update ace-kit.",
    );
  }
  return {
    deviceCode: device_code,
    userCode: user_code,
    verificationUri: verification_uri,
    expiresInSeconds: expires_in,
    intervalSeconds: Math.max(1, interval),
  };
}

/**
 * Keeps asking the CMS whether the person approved, at the pace it asks for, until they do, turn it down, or
 * the code runs out. Returns the login to keep. A few failed requests in a row are put up with (a laptop
 * changing network, say) before giving up.
 */
export async function waitForApproval(
  dependencies: Dependencies & {
    apiUrl: string;
    request: DeviceLoginRequest;
    sleep: (milliseconds: number) => Promise<void>;
    now: () => number;
  },
): Promise<StoredLogin> {
  const { apiUrl, request, sleep, now } = dependencies;
  const deadline = now() + request.expiresInSeconds * 1000;
  let intervalSeconds = request.intervalSeconds;
  let failures = 0;

  for (;;) {
    await sleep(intervalSeconds * 1000);
    if (now() > deadline)
      throw new DeviceLoginError("expired", "The code ran out before it was approved. Run ace-kit login again.");

    let response: Response;
    try {
      response = await post(dependencies, apiUrl, "/auth/device/token", { device_code: request.deviceCode });
    } catch {
      failures += 1;
      if (failures >= maximumFailures)
        throw new DeviceLoginError("unavailable", `Lost contact with the CMS at ${apiUrl}.`);
      continue;
    }

    if (response.status === 404) {
      throw new DeviceLoginError("expired", "The CMS no longer knows this login. Run ace-kit login again.");
    }
    if (response.status === 429) {
      // Asked too often: wait the longer of what it says and a little more.
      intervalSeconds += 5;
      continue;
    }
    if (!response.ok) {
      failures += 1;
      if (failures >= maximumFailures) throw new DeviceLoginError("unavailable", await readMessage(response));
      continue;
    }
    failures = 0;

    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    switch (body?.status) {
      case "pending":
        continue;
      case "slow_down":
        intervalSeconds += 5;
        continue;
      case "denied":
        throw new DeviceLoginError("denied", "The login was turned down in the admin app.");
      case "expired":
        throw new DeviceLoginError("expired", "The code ran out before it was approved. Run ace-kit login again.");
      case "approved": {
        const user = body.user as { email?: unknown } | undefined;
        if (typeof body.token !== "string" || typeof body.expires_at !== "string" || typeof user?.email !== "string") {
          throw new DeviceLoginError("unavailable", "The CMS approved the login but sent a reply that can't be read.");
        }
        return { token: body.token, expiresAt: body.expires_at, email: user.email };
      }
      default:
        throw new DeviceLoginError(
          "unavailable",
          "The CMS sent a reply this version of ace-kit can't read. Update ace-kit.",
        );
    }
  }
}

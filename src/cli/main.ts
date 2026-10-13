import type { CliEnvironment } from "./environment";
import { generateCommand, generateUsage } from "./generate-command";
import { loginCommand, loginUsage, logoutCommand, whoamiCommand } from "./login-commands";
import { syncCommand, syncUsage } from "./sync-command";

const usage = `ace-kit: tools for sites built on CMS Ace.

Commands:
  ace-kit generate   Write TypeScript types for your content types.
  ace-kit sync       Send the section types your code defines to the CMS.
  ace-kit login      Sign in from the command line (opens the admin app).
  ace-kit logout     Sign out.
  ace-kit whoami     Say who you are signed in as.

Run a command with --help for more.
`;

/** Runs one command line and returns the exit code. */
export async function runCli(commandArguments: string[], environment: CliEnvironment): Promise<number> {
  const [command, ...rest] = commandArguments;
  switch (command) {
    case "generate":
      return generateCommand(rest, environment);
    case "sync":
      return syncCommand(rest, environment);
    case "login":
      return loginCommand(rest, environment);
    case "logout":
      return logoutCommand(rest, environment);
    case "whoami":
      return whoamiCommand(rest, environment);
    case "--help":
    case "-h":
    case "help":
    case undefined:
      environment.out(usage);
      return command === undefined ? 1 : 0;
    default:
      environment.error(`Unknown command "${command}".\n\n${usage}`);
      return 1;
  }
}

export { generateUsage, loginUsage, syncUsage };

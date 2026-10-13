import { createRealEnvironment } from "./environment";
import { runCli } from "./main";

createRealEnvironment()
  .then((environment) => runCli(process.argv.slice(2), environment))
  .then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );

import type { Config } from "@react-router/dev/config";

export default {
  // Pages are rendered on the server for every request, so they always show the CMS's live content.
  ssr: true,
} satisfies Config;

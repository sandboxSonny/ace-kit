---
"@sandboxsonny/ace-kit": patch
---

The command line no longer shows where CMS Ace lives. `--help`, the messages and a new site's `.env.example` talk about CMS Ace, not an address, and connect to it without being told. `--api-url` and `ACE_API_URL` still work for a CMS on your own machine; they are just not advertised (see CONTRIBUTING.md).

---
"@sandboxsonny/ace-kit": minor
---

`ace-kit login`, `ace-kit logout` and `ace-kit whoami`: sign in to CMS Ace from the command line.

`ace-kit login` uses the OAuth device flow: the terminal shows a short code and opens the admin app, where you type the code and approve it. No password goes into the terminal. The login is kept in the macOS Keychain, or in a file only you can read on other systems, and is what the dev-server sync for sections will use. It can do much less than a browser login and ends after 30 days unused. Needs a CMS Ace API with command-line sign-in (its migration 00020). Set `ACE_TOKEN` to use a token instead (for a build server).

`ace-kit generate` is unchanged.

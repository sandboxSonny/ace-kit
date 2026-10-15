# The command line

`ace-kit` is also a command. It makes new sites, signs you in to CMS Ace from your terminal, and writes types for your content.

```sh
npx @sandboxsonny/ace-kit create my-site --site my-site.com   # make a new site (see Making a site)
npx ace-kit login      # sign in
npx ace-kit whoami     # who am I signed in as?
npx ace-kit logout     # sign out
npx ace-kit doctor     # check this site is set up properly (see Checking a site)
npx ace-kit generate   # write TypeScript types (see Typed content)
npx ace-kit sync       # send your section types to the CMS (see Sections)
```

Commands talk to the hosted CMS Ace unless told otherwise. Only for a CMS on your own machine, give `--api-url`, or set `ACE_API_URL` in the environment or a `.env` file in the folder you run it in. Failing both, a command uses the address you last signed in to (kept in a small file beside your logins), and failing that the hosted one, so `ace-kit login` and `ace-kit whoami` need no flags at all. Commands about a site (`sync`, `generate`) take `--site example.com`, or read `ACE_SITE_DOMAIN`.

## Making a site

```sh
npx @sandboxsonny/ace-kit create my-site my-site.com
```

One command makes everything a new site needs:

1. **Checks** the folder, the domain and the name, before anything is made.
2. **Signs you in** if you aren't already (your browser opens; type the code from the terminal, as in [Signing in](#signing-in)).
3. **Makes the site in CMS Ace** and gives it a starter: a `pages` content type, Home, About and Contact entries, a main menu and the three example section types (hero, FAQ, gallery).
4. **Copies a starter site** into `my-site/` with its name, domain and package name filled in.

If a site with that domain already exists in CMS Ace, it is **left alone** (nothing is added to it, in case it has real content), a warning says so, and only the folder is made. If the CMS refuses to make the site (for instance, you have made as many as your account allows) nothing is made at all.

Your account must be a **partner or super admin** (only they can make sites). The login `create` uses can set up the site it just made, for an hour, and no other site: it can't write content anywhere else.

| Option                            | Meaning                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `<domain>` (or `--site <domain>`) | The domain the site has in CMS Ace. Required.                                         |
| `--framework astro\|react-router` | `astro` (the default) or `react-router`. Both have the same three example sections.   |
| `--name <name>`                   | The name shown to visitors. Default: made from the folder, so `my-site` is "My Site". |
| `--api-url <address>`             | Only for a CMS on your own machine (or set `ACE_API_URL`).                            |

Against a CMS on your own machine (`--api-url` or `ACE_API_URL` set to `http://localhost:8080`), it also writes a `.env` in the new folder with `ACE_API_URL` and `ACE_PREVIEW_ADMIN_ORIGIN=http://localhost:5173`, and sets the site's Preview address to the local dev server (`http://localhost:4321`, or 4322 for React Router), so the site and live preview work with no more setup. Against the hosted CMS Ace none of that is needed.

The folder must not exist yet (or must be empty). The starter is a small server-rendered site with a header, footer, rich text, live preview and Prettier, ESLint, tests and a CI workflow. When it finishes: `cd my-site`, `npm install`, `npm run dev`.

## Checking a site

```sh
npx ace-kit doctor
```

Run it in your site's folder when something isn't working. It changes nothing, never prints your login, and says what to do about each problem:

```
  ✓ Node 24.14.0
  ✓ An Astro site
  ✓ Ace Kit 0.6.0 is installed
  ✓ CMS: https://api.ace-cms.co.uk (the hosted CMS Ace)
  ✓ Site: shop.example.com
  ✓ The CMS answers
  ✓ The CMS knows the site: "Shop"
  ✓ Pages has 3 published entries, including home
  ✓ Signed in as sam@example.com
  ✓ 3 section types in your code (faq, gallery, hero)
  ✓ The CMS has all of them
```

It checks your Node version, that Ace Kit is installed, which CMS and site your settings point at, that the CMS can be reached and knows the site, that the site has its Pages content, that you are signed in, the site's preview address, and that the section types in your code match the CMS. `✗` is a problem (the command exits with 1), `!` is a warning, `-` is a note. It takes `--site`, `--api-url` and `--dir` like `sync`.

## Signing in

```sh
npx ace-kit login
```

```
Signing in to https://api.ace-cms.co.uk

  1. Go to   https://app.ace-cms.co.uk/device
  2. Type    BCDF-GHJK

Check the code on that page matches. Waiting for you to approve it (Ctrl-C to cancel)...
```

Your browser opens the CMS admin app's approval page. **Type the code from your terminal** into it (it is deliberately not in the link), check that the tool and the address it shows are yours, and choose **Approve**. The terminal then says who you are signed in as. This is the OAuth device flow, the same shape as `gh auth login`: no password is ever typed into the terminal, and nothing secret is written in a file inside your project.

Only approve a login you started just now, from your own terminal. If the code on the page doesn't match the one in your terminal, or you didn't ask for a login, choose **Turn it down**.

## Where the login is kept

- **On a Mac:** the macOS Keychain, as an item named `ace-kit` whose account is the API address. You can see it in Keychain Access. Ace Kit uses the `security` program that comes with macOS, so nothing native is installed, and the login is handed to it on standard input, never as an argument other users of the machine could read.
- **Anywhere else:** a file only you can read, `~/.config/ace-kit/credentials.json` (mode `0600`, in a folder of mode `0700`; `%APPDATA%\ace-kit` on Windows). Set `XDG_CONFIG_HOME` to move it.
- Set `ACE_KIT_CREDENTIALS=file` to use the file even on a Mac.

One login is kept per API address, so you can be signed in to a local CMS and a hosted one at once.

## What a command-line login can do

Much less than you can in the browser. It can see which sites you can reach, read their content types, and read and sync their section types (the last only on a site where you are an owner, or a super admin). It cannot manage members, passwords or other logins, read or change entries and images, or approve another command-line login. It lasts 90 days at most and ends after 30 days unused. A super admin sees it on the Sessions screen, named after your machine, and can end it from there.

## Build servers

A build server has nobody to approve a login in a browser. Set `ACE_TOKEN` to a token instead and Ace Kit uses it in place of a stored login. (Tokens for this are not made yet; for now sign in on the machine that needs it.)

## Signing out

`npx ace-kit logout` ends the login at the CMS and forgets it on this machine. If the CMS can't be reached it still forgets it here, and says so.

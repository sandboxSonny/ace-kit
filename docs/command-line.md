# The command line

`ace-kit` is also a command. It signs you in to CMS Ace from your terminal, and writes types for your content.

```sh
npx ace-kit login      # sign in
npx ace-kit whoami     # who am I signed in as?
npx ace-kit logout     # sign out
npx ace-kit generate   # write TypeScript types (see Typed content)
npx ace-kit sync       # send your section types to the CMS (see Sections)
```

Every command takes `--api-url`, or reads `ACE_API_URL` from the environment or a `.env` file in the folder you run it in. Failing both, it uses the address you last signed in to (kept in a small file beside your logins), so after `ace-kit login --api-url …` you can simply run `ace-kit whoami` from anywhere.

## Signing in

```sh
npx ace-kit login --api-url http://localhost:8080
```

```
Signing in to http://localhost:8080

  1. Go to   http://localhost:5173/device
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

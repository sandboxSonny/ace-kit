# Releasing

Versions and the changelog are managed with [Changesets](https://github.com/changesets/changesets), and releases are published to [npm](https://www.npmjs.com) by GitHub Actions. The package follows [semantic versioning](https://semver.org): patch for fixes, minor for backwards compatible additions, major for breaking changes. While the version is below 1.0.0, a minor release may contain breaking changes (say so in the changeset).

## Day to day

Every change that someone using the kit would notice gets a changeset:

```sh
npm run changeset
```

It asks for the size and a summary, and writes a small file in `.changeset/`. Commit it with the change. Nothing else is needed.

## Releasing

When changes are merged to `main`, the **Release** workflow opens (or updates) a pull request called "Version Packages". It bumps `package.json` and writes the summaries into `CHANGELOG.md`. Read it, then merge it: the workflow then publishes the new version to npm and tags it.

Each published version carries npm **provenance**: a public statement, signed by GitHub, that this exact package was built from this repository by this workflow. People can check it on the package's npm page (and with `npm audit signatures`).

## One-time setup

1. **Own the scope.** The package is `@sandboxsonny/ace-kit`; a scope on npm belongs to a user or an organisation of that name. [Create an npm account](https://www.npmjs.com/signup) called `sandboxsonny` (or an organisation with that name) and turn on two-factor authentication. If the name isn't available, pick another scope and follow "If the scope changes" below.
2. **A public repository,** with branch protection on `main` that requires the CI checks, so a release can only come from reviewed, passing code. Also turn on private vulnerability reporting (Settings → Security), which `SECURITY.md` points to.
3. **The first publish,** which needs a token because the package doesn't exist yet to attach trusted publishing to. Create a _granular access token_ on npm with read and write permission on the scope and a short expiry, store it in the repository as the secret `NPM_TOKEN`, and pass it to the release step as `NODE_AUTH_TOKEN`. (Or publish version 0.1.0 by hand: `npm login`, then `npm run release`.)
4. **Trusted publishing,** so no token is needed after that. On the package's page on npmjs.com → Settings → Trusted Publisher, add GitHub Actions with: the owner and repository exactly as GitHub spells them (**`sandboxSonny`** and **`ace-kit`**: the capitals matter), and the workflow file name **`release.yml`**. npm shows it as "not yet validated" until one publish goes through it, and drops it if that doesn't happen within 48 hours. Make the next release (even a patch with no code change) to validate it.
5. **Remove the token:** delete the `NPM_TOKEN` secret and revoke the token on npm, and make sure the workflow does not pass `NODE_AUTH_TOKEN` (npm would use it instead of the trusted route).

The workflow in this repository is already in the last state: no token, Node 24 with npm 11.5.1 or newer, and `id-token: write`. If a publish fails with a message about authentication, check that the repository name and workflow file name in the Trusted Publisher settings match exactly, and that the job really is running `release.yml` on `main`.

## What the checks protect

`npm run release` and CI run `npm run check`, which ends with `scripts/check-package.mjs`. It fails if a file the package points at is missing, if the command line tool has no `#!` line, if sources or tests would be published, or if `package.json` is not set up for publishing (scoped name, public access).

## Trying it before it is published

`npm run pack:local` builds the package and packs it into `sandboxsonny-ace-kit-<version>.tgz`, which is exactly what would be published. Install that file in a site (`npm install /path/to/sandboxsonny-ace-kit-0.1.0.tgz`). Prefer this to linking the folder (`file:../ace-kit`): a link hides problems a real install has (missing files, a wrong `exports` map), and Astro cannot find the preview script through an absolute link from outside the project.

## If the scope changes

The package name appears in `package.json`, in `src/helpers/package-name.ts` (generated types augment it; a test checks the two agree), in the docs, and in the integration code (`src/astro/integration.ts`). Search for `@sandboxsonny` and change it everywhere, then add a major changeset: consumers must change their imports.

## Publishing to GitHub Packages instead

Possible, with more friction for everyone who installs: GitHub's npm registry asks for a token even for public packages. Set `publishConfig.registry` to `https://npm.pkg.github.com`, `registry-url` in the workflow to the same, `NODE_AUTH_TOKEN` to `${{ secrets.GITHUB_TOKEN }}`, give the job `packages: write`, and tell users to add `@sandboxsonny:registry=https://npm.pkg.github.com` and a `read:packages` token to their `.npmrc`. (Provenance isn't available there.)

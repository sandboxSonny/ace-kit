# Security policy

Ace Kit draws content from a CMS into other people's websites, so its safety matters to everyone who installs it. Things that count as security problems include: text or an address in a document that gets past the escaping or the link checks and runs script on a page; a way to make the live-preview support accept a message from, or be framed by, an origin that wasn't configured; settings, tokens or the CMS address reaching the browser; and a way to make a server using the kit run out of memory through addresses a visitor chooses.

## Reporting a problem

Please **don't open a public issue**. Report it privately, either:

- with GitHub's [private vulnerability reporting](https://github.com/sandboxsonny/ace-kit/security/advisories/new) (Security tab → Report a vulnerability), or
- by email to sonny@adamsdevelopment.co.uk with "Ace Kit security" in the subject.

Say what you found, which version, and how to reproduce it. You can expect a reply within a few days, a fix or a clear explanation as soon as it can be done, and credit in the changelog if you want it.

## Supported versions

Only the latest release is supported with security fixes while the version is 0.x.

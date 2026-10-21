---
"@sandboxsonny/ace-kit": patch
---

Update the starter sites that `ace-kit create` copies. The Astro starter moves `eslint-plugin-astro` from 1.x to 3.x, which removes the five high-severity `npm audit` findings a new site started with (through `astro-eslint-parser`, `fast-glob`, `micromatch` and `braces`), and both starters move `jsdom` to 30. Sites you have already made keep their own versions: run `npm install eslint-plugin-astro@latest jsdom@latest --save-dev` in them.

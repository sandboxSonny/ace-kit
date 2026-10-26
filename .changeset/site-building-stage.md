---
"@sandboxsonny/ace-kit": minor
---

A site that hasn't launched yet has no dev site: the dev server reads from it and syncs sections and forms to it directly, so the content you enter while building it is the content it launches with. The client now sends `X-Ace-Environment` (`production` or `development`, from the new `environment` option or `ACE_ENVIRONMENT`), and a site launches itself the first time its production website reads from it.

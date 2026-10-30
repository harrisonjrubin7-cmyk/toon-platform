# AppDeploy hosting

Live site: https://toon-comics-and-studios-fryq35.v2.appdeploy.ai/

App ID: `toon-comics-and-studios-fryq35`

Ready snapshot: `1793382480258`

This folder preserves the normalized AppDeploy source snapshot for the public studio site. Use the existing AppDeploy app ID for future updates, read its latest stored source first, and send only changed files. GitHub pushes do not automatically deploy this app.

The app uses the html-static Vite template. To run independently with Node.js installed:

```sh
npm install
npm run dev
```

The public cover URLs are pinned to the original imported GitHub commit. Personal document links are omitted; source drafts remain private. Browser-local shortlist and reading marks are scoped to this new origin and do not migrate from the previous site.

Validation: JavaScript syntax and static references checked before submission. AppDeploy reported ready with no frontend or network errors in its QA snapshot. Five workflow scenarios are supplied in tests/tests.json; the status response did not supply individual scenario pass results.

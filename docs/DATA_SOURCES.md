# Data sources

The canonical, machine-readable list is `src/data/sources.ts`. Every scientific value shown in the
app must come from a live API response, a pipeline file in `public/data/`, or a `sources.ts` entry.

Entries with `verified: false` have a reachable URL but their content has not been reviewed by a human yet.
No DOIs are recorded until they are copied from the publisher's page.

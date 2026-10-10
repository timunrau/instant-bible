# Source and implementation review

Before implementation, inspected `timunrau/rum1n8` at default-branch commit `e1b7a99`, read-only. Relevant files: `src/bible-cache.js`, `src/utils/bible-reference.js` and its tests, `src/components/VerseReferenceInput.vue`, the new-verse/import handling in `src/App.vue`, `Dockerfile.app`, Compose, and `.github/workflows/deploy.yml`.

Rum1N8 uses `@gracious.tech/fetch-client` 2.4.0, `FetchClient`, `fetch_collection()`, `collection.bibles.get_books()`, `get_book_url()`, and whole-translation Cache Storage. Its local alias table, conservative ambiguous-prefix handling, and canonical range tests informed our smaller local wrapper. Its plain-text import is useful for verse memorization; this reader instead uses normalized HTML to preserve the original document structure. Its application scope, sync, analytics, large root component, and central Watchtower service were not carried into this project. GHCR owner is the authenticated account `timunrau`.

Inspected the current npm package, official repository source (commit `6df3fb7`; `client/src/client.ts`, `collection/bibles.ts`, `collection/generic.ts`, `book/bible.ts`, `book/html.ts`, licensing utilities), and actual manifest/BSB responses. Supported integration:

1. `new FetchClient({ usage: { limitless: true, derivatives: true }, remember_fetches: false })`.
2. `fetch_collection()` and `get_resources({ language: 'eng', exclude_incomplete: true })` apply the usage/license filters.
3. `collection.bibles.fetch_book(id, book, 'html')` returns `BibleBookHtml`.
4. `get_chapter(number, { attribute: false })` reassembles verse triples into original paragraphs. Attribution is preserved separately in metadata and settings.
5. A small allowlist converts that HTML to semantic blocks/fragments/nodes. Both browser DOMParser and the updater's linkedom document use the same normalization function. No arbitrary HTML reaches Vue.

The HTML contains section headings, multi-paragraph verses, indented poetry, inline styles, and notes, so raw USFM is unnecessary. Psalm descriptive headings can contain verse markers; they are preserved and update the current semantic verse. BSB source omissions are recorded and validated, never filled from another translation. Default BSB contains 31,086 numbered verses in 1,189 chapters and 66 books. Source metadata declares BSB public domain/CC0, with BSB Publishing, LLC attribution retained.

The reader now supports bundled BSB only. The fetch(bible) client and HTML normalization remain development tools for the BSB updater; runtime catalog browsing and optional downloads have been removed. Earlier optional-translation caches are cleaned up in the background.

Official references: [fetch(bible) client](https://fetch.bible/access/client/), [manual formats](https://fetch.bible/access/manual/), [source](https://github.com/gracious-tech/fetch), [BSB](https://berean.bible/). The lockfile pins the implementation inspected. Updating the source dependency or BSB licensing needs another review.

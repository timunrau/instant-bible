# Source and implementation review

## Official BSB USJ source (2026-11-08)

The reader is generated from the unchanged publisher archive at <https://bereanbible.com/bsb_usj.zip>, linked from <https://berean.bible/downloads.htm> as the current third printing. The committed archive and its SHA-256/provenance are in `sources/bsb`. The publisher declares the text public domain at <https://berean.bible/licensing.htm>. BSB Publishing, LLC attribution remains in settings. No third-party Scripture text is combined with this edition.

USJ was selected over USFM (requires a markup parser), USX (equivalent XML structure), and presentation formats because it exposes ordered semantic records directly in JSON. The inspected USJ, USX, and USFM samples contain explicit heading references absent from fetch(bible)'s HTML. The official archive contains 66 books, 1,189 chapters, 31,086 numbered verses, 4,854 footnotes, and 1,325 heading-reference paragraphs with 2,033 reference entries.

The development importer preserves paragraphs, poetry, indentation, Psalm descriptive-heading milestones, emphasis, and source punctuation. Words-of-Jesus wrappers are flattened while retaining nested verse milestones; no red-letter styling is added. USJ `fqa` becomes emphasis, `fv` remains note text, and `r` becomes a non-Scripture reference block. Five `ms` headings restore BOOK I–V in Psalms. Unknown content structures fail generation. Canonical metadata remains a direct development dependency; the fetch(bible) client, linkedom, and HTML importer have been removed.

Structured reference locations are checked against their visible labels. Single-chapter locations such as `OBA 1-14` are interpreted as verses. Two Song of Solomon references have incomplete locations, and five references lack locations; their explicit labels resolve locally. Joshua–Malachi opens Joshua 1 without encoding the full span. Seven explicit note references outside the supported canon (Jasher, 1 Esdras, and 1 Enoch) remain text and are reported by the updater. Existing unstructured footnote citations continue using the local citation recognizer.

### Migration comparison

Compared every canonical verse with the previous committed fetch(bible) corpus, combining semantic fragments and normalizing whitespace. Exactly four Scripture texts differ:

- Genesis 35:18, Luke 9:33, Acts 4:36: official USJ does not contain the stray literal `vvv` present in the previous source output.
- 2 Timothy 1:15: official USJ reads “province of Asia”; previous output capitalized “Province”.

All 4,854 footnotes remain. Their flattened text differs only in four source spacing defects: Genesis 10:23 (`1:17Meshech`), 1 Chronicles 6:58 (`21:15Holon`), Ezra 2:2 (`7:7accompanied`), and Nehemiah 7:7 (`2:2accompanied`). These are preserved exactly, not silently corrected. USJ retains 5,298 emphasis nodes versus 5,277 previously. All existing heading text is preserved, with only the five Psalm book headings added. No Scripture has been hand-copied or patched.

`bible:update-bsb` is network-free and verifies the pinned archive checksum. `bible:validate` checks generated data against a fresh import, canonical coverage, omissions, checksums, and complete heading-reference coverage. Normal builds consume only generated local book assets. Source replacement must be deliberate and accompanied by another content review.

## Historical fetch(bible) review

Before implementation, inspected `timunrau/rum1n8` at default-branch commit `e1b7a99`, read-only. Relevant files: `src/bible-cache.js`, `src/utils/bible-reference.js` and its tests, `src/components/VerseReferenceInput.vue`, the new-verse/import handling in `src/App.vue`, `Dockerfile.app`, Compose, and `.github/workflows/deploy.yml`.

Rum1N8 uses `@gracious.tech/fetch-client` 2.4.0, `FetchClient`, `fetch_collection()`, `collection.bibles.get_books()`, `get_book_url()`, and whole-translation Cache Storage. Its local alias table, conservative ambiguous-prefix handling, and canonical range tests informed our smaller local wrapper. Its plain-text import is useful for verse memorization; this reader instead uses normalized HTML to preserve the original document structure. Its application scope, sync, analytics, large root component, and central Watchtower service were not carried into this project. GHCR owner is the authenticated account `timunrau`.

Inspected the current npm package, official repository source (commit `6df3fb7`; `client/src/client.ts`, `collection/bibles.ts`, `collection/generic.ts`, `book/bible.ts`, `book/html.ts`, licensing utilities), and actual manifest/BSB responses. Supported integration:

1. `new FetchClient({ usage: { limitless: true, derivatives: true }, remember_fetches: false })`.
2. `fetch_collection()` and `get_resources({ language: 'eng', exclude_incomplete: true })` apply the usage/license filters.
3. `collection.bibles.fetch_book(id, book, 'html')` returns `BibleBookHtml`.
4. `get_chapter(number, { attribute: false })` reassembles verse triples into original paragraphs. Attribution is preserved separately in metadata and settings.
5. A small allowlist converts that HTML to semantic blocks/fragments/nodes. Both browser DOMParser and the updater's linkedom document use the same normalization function. No arbitrary HTML reaches Vue.

The HTML contains section headings, multi-paragraph verses, indented poetry, inline styles, and notes, so raw USFM is unnecessary. Psalm descriptive headings can contain verse markers; they are preserved and update the current semantic verse. BSB source omissions are recorded and validated, never filled from another translation. Default BSB contains 31,086 numbered verses in 1,189 chapters and 66 books. Source metadata declares BSB public domain/CC0, with BSB Publishing, LLC attribution retained.

At that stage, the reader supported bundled BSB only. The fetch(bible) client and HTML normalization remained development tools for the BSB updater; runtime catalog browsing and optional downloads have been removed. Earlier optional-translation caches are cleaned up in the background.

Official references: [fetch(bible) client](https://fetch.bible/access/client/), [manual formats](https://fetch.bible/access/manual/), [source](https://github.com/gracious-tech/fetch), [BSB](https://berean.bible/). The lockfile pins the implementation inspected. Updating the source dependency or BSB licensing needs another review.

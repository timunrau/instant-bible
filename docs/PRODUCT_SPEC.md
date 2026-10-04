# Instant Bible v1 behavioral contracts

**Bible** is an offline-first, one-column Scripture reader. Opening Scripture and jumping to a known passage must feel immediate. There is no splash screen, navigation header, dashboard, or persistent search. The normal bottom bar contains book/chapter and Aa; a selection replaces it with count, Copy, Share, Clear.

## Opening and reading

- First launch: Genesis 1, BSB, serif, 20px, relaxed spacing, Auto theme.
- Later launches restore translation, canonical verse, and fractional verse position. Explicit chapter navigation preserves the chapter heading. Evicted optional data falls back to BSB at the same canonical reference.
- A small chapter window includes three chapters before and five after the current chapter, bounded at Genesis 1 and Revelation 22. Rebalancing preserves the existing chapter's pixel position. Books follow naturally across boundaries.
- Explicit chapter/verse jumps place their origin 24px from the phone top or 48px from the desktop top. Verse navigation never centers the verse. Clear horizontal intent changes one chapter; vertical/diagonal gestures and native selection remain native.
- Translation paragraphs, poetry/indentation, headings, italics, small caps, and notes survive normalization. Verse numbers, including 1, remain visible. All fragments of a verse share its canonical ID.
- Default Source Serif 4 is bundled locally. Desktop measure stays near 65–75 characters. The only reading column remains readable with browser text scaling.

## Reference interaction

- The bottom reference gesture reveals an already-mounted input, synchronously focuses it, and selects its text. No network or animation can delay focus.
- Parse every keystroke locally; show one canonical interpretation where possible. Incomplete or invalid typing has no error. A rejected submission has a small inline error.
- Enter and Go are equivalent. Book alone means chapter 1. Abbreviations, omitted spaces, trailing colon, lists, and ranges are supported. Single-chapter books accept verse syntax naturally. Ambiguous books and nonexistent chapters/verses are rejected.
- Ranges/lists scroll to their first canonical verse and temporarily indicate those verses. This never opens selection mode.
- The translation abbreviation sits beside the input. Its picker preserves the typed draft and lists installed translations first. Selecting an available translation automatically installs the whole Bible while current Scripture remains on screen. No confirmation or separate Download button.

## Data and offline

- Real BSB data from fetch(bible) ships in the repository and is precached with the app/fonts. Normal builds never fetch Scripture. Content-addressed book filenames allow immutable HTTP caching.
- Generated metadata includes SHA-256 checksums and source-omitted canonical verses. Missing source verses are never invented; navigating to an omitted number chooses the nearest available verse in that chapter.
- A conservative English, left-to-right, complete-Bible catalog is filtered through fetch(bible)'s limitless/derivatives license policy. Every install rechecks the current supported catalog. Attribution and license links remain accessible in settings.
- Optional books and metadata use Cache Storage format v1. An installation is ready only if compatible metadata and every canonical book are present. The metadata marker is written last. Failure removes partial content. Format changes discard optional caches. BSB cannot be removed.
- Installed optional Scripture is read directly from Cache Storage. Precached BSB navigation remains local under the service worker. Denied persistence/storage never blocks BSB reading.
- PWA updates wait for the old app to close; no forced reload interrupts reading. No external scripts, fonts, analytics, database, or backend.

## URLs and history

- Canonical paths: `/John/3?version=BSB`, `/John/3/16-18?version=BSB`, numbered books use hyphens. Every generated URL includes its version.
- Arbitrary multi-chapter/book selections use a stable `selection` query of canonical IDs. Incoming optional-version links automatically install and switch to the intended reference. Offline failure keeps current Scripture readable with retry.
- Typed submissions and chapter swipes push history entries. Vertical scrolling replaces the current entry at a throttled cadence. Back restores the semantic position saved before the jump.
- Document title follows `Romans 8 — Bible`.

## Selection, notes, and text export

- A short stationary tap toggles an entire semantic verse. Noncontiguous selection persists during scrolling; clearing the final verse exits. Explicit navigation clears it.
- Long presses, native word selection, and drags do not trigger verse selection. Selected fragments use restrained inline highlighting.
- Copy is plain text in canonical order. First selected verse has no number; subsequent verses have inline numbers once per semantic verse. Keep sensible prose paragraphs, flatten poetry, exclude headings/notes, then a blank line and compressed reference/version.
- Share includes complete selected Scripture, reference/version, and a selection deep link. Web Share is preferred; copy the full payload if unavailable. Confirmation stays on the control.
- Footnotes use subtle superscripts with expanded tap targets. Small phone sheets/desktop anchored popovers preserve reading position; they do not navigate cross-references.

## Settings and exclusions

Serif/Sans, discrete text sizes, Compact/Normal/Relaxed spacing, Auto/Light/Dark theme, attribution, optional-translation removal, and build information. Light is exact white/black; AMOLED is exact black/white on all surfaces. Settings persist locally. No About screen or install banner.

Excluded: text search, accounts, sync, database, bookmarks, saved highlights/notes, plans, audio, AI, recent-reference UI, cross-reference navigation, two columns, comparisons, split screen, community, analytics, ads, conventional menus.

`tests/unit` specifies pure logic and semantic components. `tests/e2e` specifies startup, focus, reading, navigation, history, settings, selection, translation installation, real offline behavior, swipes, and canonical phone/desktop visual states. Never weaken tests to get a green result.

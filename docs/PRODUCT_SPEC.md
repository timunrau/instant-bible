# Instant Bible v1 behavioral contracts

**Bible** is an offline-first, one-column Scripture reader. Opening Scripture and jumping to a known passage must feel immediate. There is no splash screen, navigation header, dashboard, or persistent search. The normal bottom bar contains book/chapter and Aa; a selection replaces it with count, Copy, Share, Clear.

## Opening and reading

- First launch: Genesis 1, BSB, serif, 20px, Normal spacing, Auto theme. Existing supported spacing preferences survive updates.
- Later launches restore the canonical verse and fractional verse position in BSB. Explicit chapter navigation preserves the chapter heading. Saved positions from older translations restore the same canonical reference in BSB.
- A small chapter window includes three chapters before and five after the current chapter, bounded at Genesis 1 and Revelation 22. Rebalancing preserves the existing chapter's pixel position. Books follow naturally across boundaries.
- Explicit chapter/verse jumps place their origin 24px from the phone top or 48px from the desktop top. Verse navigation never centers the verse. Clear horizontal intent changes one chapter; vertical/diagonal gestures and native selection remain native.
- BSB paragraphs, poetry/indentation, headings, italics, small caps, and notes survive normalization. Verse numbers, including 1, remain visible at the first Scripture fragment, even when the source marker occurs in a descriptive heading. Headings retain their text but do not act as verse navigation or selection targets. All Scripture fragments of a verse share its canonical ID.
- Default Source Serif 4 is bundled locally. Desktop measure stays near 65–75 characters. The only reading column remains readable with browser text scaling.

## Reference interaction

- The bottom reference gesture reveals an already-mounted input, synchronously focuses it, and selects its text. No network or animation can delay focus.
- The reference sheet stays within the visible viewport above the mobile keyboard, including when the browser pans that viewport. Opening and dismissing it preserves the reading position.
- Parse submitted references locally. The input and Go button are sufficient; no duplicate interpretation or hint row appears beneath them. Incomplete or invalid typing has no error. A rejected submission has a small inline error.
- Enter and Go are equivalent. Book alone means chapter 1. Abbreviations, omitted spaces, trailing colon, lists, and ranges are supported. Single-chapter books accept verse syntax naturally. Ambiguous books and nonexistent chapters/verses are rejected.
- Ranges/lists scroll to their first canonical verse and temporarily indicate those verses. This never opens selection mode.
- The reference form contains only the input and Go button. BSB is the only translation; there is no translation picker or download control.

## Data and offline

- Real BSB data from fetch(bible) ships in the repository and is precached with the app/fonts. Normal builds never fetch Scripture. Content-addressed book filenames allow immutable HTTP caching.
- Generated metadata includes SHA-256 checksums and source-omitted canonical verses. Missing source verses are never invented; navigating to an omitted number chooses the nearest available verse in that chapter.
- BSB is the only supported Bible. Its attribution and license links remain accessible in settings. The fetch(bible) client is used only by the development updater; it is excluded from application JavaScript.
- Optional-translation caches from older releases are removed in the background without touching the BSB service-worker precache or unrelated caches. BSB cannot be removed.
- Precached BSB navigation remains local under the service worker. Denied persistence/storage never blocks BSB reading.
- Background PWA updates wait for the old app to close; no automatic reload interrupts reading. Tapping the version in Reading settings explicitly checks for an update, waits for its complete installation, activates it, saves the semantic reading anchor, and reloads. Other open readers never reload automatically. Offline, failed, and timed-out checks keep the current reader and precached BSB intact, show a status, and allow retry. No external scripts, fonts, analytics, database, or backend.

## URLs and history

- Canonical paths: `/John/3?version=BSB`, `/John/3/16-18?version=BSB`, numbered books use hyphens. Every generated URL includes its version.
- Subdirectory deployments prefix canonical paths and local assets with the deployment base (for example `/instant-bible/John/3?version=BSB`). Direct links preserve passage and selection in BSB. GitHub Pages serves the reader shell as its custom 404 document; installed service workers serve normal/offline navigation from the precached shell.
- Arbitrary multi-chapter/book selections use a stable `selection` query of canonical IDs. Incoming links requesting an older translation open the intended passage/selection in BSB and normalize the URL to `version=BSB` without a download.
- Typed submissions, footnote cross-reference links, and chapter swipes push history entries. Vertical scrolling replaces the current entry at a throttled cadence. Back restores the semantic position saved before the jump.
- Desktop Left/Right arrow keys jump one chapter, cross book boundaries, and stop at the ends of Scripture. `/` opens and synchronously focuses the reference picker. Ctrl+C (Cmd+C on Mac) copies semantically selected verses using the same output and confirmation as Copy. Escape dismisses an open dialog first; otherwise it clears the verse selection and restores the normal bottom bar. Other shortcuts leave typing, composition, dialogs, modified navigation keys, and native text selection to the browser.
- Document title follows `Romans 8 — Bible`.

## Selection, notes, and text export

- A short stationary tap toggles an entire semantic verse. Noncontiguous selection persists during scrolling; clearing the final verse exits. Explicit navigation clears it.
- Long presses, native word selection, and drags do not trigger verse selection. Selected fragments use a visible 2px dotted underline with no background fill.
- Copy is plain text in canonical order. First selected verse has no number; subsequent verses have inline numbers once per semantic verse. Join all selected text into one paragraph, flatten poetry, exclude headings/notes, then a single newline and compressed reference/version.
- Desktop selection shows a small Ctrl+C hint (⌘C on Mac) beside Copy. Touch/mobile layouts hide the hint.
- Share includes complete selected Scripture, the reference/version on the next line, and a selection deep link on its own next line. The same complete text payload is passed to Web Share or copied when sharing is unavailable or fails; a cancelled share does not copy. Confirmation stays on the control.
- Footnotes use subtle superscripts with expanded tap targets. Small phone sheets/desktop anchored popovers preserve reading position. Explicit canonical Bible citations in source footnotes are clickable passage links, using BSB and working offline. Following one closes the footnote, clears selection, and jumps to the first cited verse with temporary range indication. Back restores the prior semantic reading position. References outside the supported canon remain source text.

## Settings and exclusions

Serif/Sans, discrete text sizes, Compact/Normal/Relaxed spacing, Auto/Light/Dark theme, attribution, and build information. Translation controls and the extra fetch(bible) source-credit line do not appear in Reading settings. Light is exact white/black; AMOLED is exact black/white on all surfaces. Settings persist locally. No About screen or install banner.

Browser/PWA chrome requests black in both reader themes. The maskable app icon keeps its artwork well inside the central safe circle with generous padding and an opaque background.

Excluded: text search, accounts, sync, database, bookmarks, saved highlights/notes, plans, audio, AI, recent-reference UI, two columns, comparisons, split screen, community, analytics, ads, conventional menus.

`tests/unit` specifies pure logic and semantic components. `tests/e2e` specifies startup, focus, reading, navigation, history, settings, selection, BSB-only compatibility with old links/positions, real offline behavior, swipes, and canonical phone/desktop visual states. Never weaken tests to get a green result.

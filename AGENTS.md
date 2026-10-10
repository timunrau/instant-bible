# Instant Bible

This app makes opening Scripture and jumping to a passage feel instantaneous. Priorities: **speed → simplicity → reading quality → offline reliability → everything else**. Fast and stable beats architecturally clever. Push back on ideas that compromise these priorities, while honoring specific user requests.

## Before changing behavior

Read [the product contracts](docs/PRODUCT_SPEC.md), the relevant unit fixture, and the relevant Playwright tests. Tests are executable product specifications. Never weaken or delete a test merely to make a change pass. Fix the implementation or explain a deliberate, authorized contract change. Expand the table-driven reference fixture when adding syntax.

## Architecture constraints

- Vue 3, strict TypeScript, small composables and pure modules, plain CSS, browser primitives.
- No backend without an explicit new requirement. No database. No IndexedDB in v1.
- The service worker precaches immutable BSB data; localStorage holds only small preferences and semantic anchors.
- BSB is bundled and precached, always available, and cannot be removed. Never fabricate, hand-copy, or silently patch Scripture.
- BSB navigation and local parsing must not depend on the network. No spinner during ordinary navigation. Network work never gates the initial reader.
- Preserve paragraphs, headings, poetry, emphasis, small caps, verse fragments, and notes. A semantic verse may span multiple inline fragments. Copy/share use semantic data, never DOM scraping.
- Only bundled BSB is supported. Do not add translation switching or downloads. Remove legacy optional caches without touching the BSB precache. Preserve and check source licensing.
- Maintain a stable bounded chapter window. Preserve a visual anchor when adding/removing chapters and a semantic anchor across restarts, typography changes, and resize.
- Focus the already-mounted reference input synchronously in the tap handler; never defer mobile keyboard focus to an animation, await, or nextTick.
- Typed reference submission, swipe, deep links, Back, selection and copy contracts live in the specification/tests.
- All generated URLs explicitly include a version. Vertical reading uses replaceState; explicit jumps use pushState and preserve the prior semantic anchor.
- True AMOLED means exact #000000 surfaces and #FFFFFF Scripture. Apply theme before mount. Fonts are self-hosted.
- Never automatically reload an active reader for a service worker update. Only an explicit tap on the version control may activate an installed update and reload, preserving the semantic reading anchor and precached BSB.
- Optimize touch/mobile first while keeping desktop excellent. Maintain keyboard access, native word selection, and reduced-motion support.
- Don't casually add persistent UI. Scripture owns the screen; the normal reader has only its bottom reference/Aa bar.

## Scope boundaries

Source footnotes may link their explicit canonical Bible citations to passages in the BSB. Do not add search, accounts, sync, server state, databases, saved highlights/bookmarks/notes, reading plans, audio, AI, recent-reference UI, comparison, split screen, two columns, community, analytics, ads, or a conventional navigation menu.

## Working commands

Use Conventional Commits for all new commits and PR titles: `feat:`, `fix:`, `perf:`, `refactor:`, `build:`, `ci:`, `docs:`, `test:`, `style:`, `chore:`, or `revert:` with an optional scope. Use `!` or a `BREAKING CHANGE:` footer for breaking changes. CI enforces this; semantic-release owns versions, release tags, and the changelog. Do not manually bump package versions.

Run `npm run check` before considering work complete. It covers lint, strict types, BSB validation, unit/components, production build, JS budget, browser/offline/visual tests. Install Chromium with `npx playwright install chromium` first. Docker verification is separate: build the production image, verify `/healthz`, direct deep-link fallback, and headers. `Dockerfile.test` offers the same browser environment as Linux CI.

BSB updater: `npm run bible:update-bsb`; validator: `npm run bible:validate`. Generated content lives in `public/bibles/v1/BSB`, its content-addressed asset index in `src/data/bsb-assets.json`. Read `docs/SOURCE_REVIEW.md` before altering fetch(bible) integration. Keep generated assets and lockfile committed. Build/version information is injected by Vite; Docker passes BUILD_SHA.

Visual baselines are platform-specific. Inspect changed screenshots; do not blanket-update baselines to hide regressions. Use the Linux test image for CI baseline updates. Keep the total gzipped application JS under 75 KiB, excluding development-only source tools; Bible/font assets and service-worker code are excluded.

Whenever the UI changes, run `npm run screenshots`, review the three generated mobile PNGs in `docs/screenshots`, and include them with the change. Install Chromium first with `npx playwright install chromium` if needed. The command builds production, starts and stops its own preview server on port 4174, and captures the reader, passage picker, and settings with a fresh browser context, fixed phone viewport, and light theme after fonts and Scripture load. Keep README screenshots mobile-only and use one theme; use standard Markdown image embeds without a table. Visual test baselines are managed separately.

When writing Markdown, indent nested list items with literal tabs rather than spaces.

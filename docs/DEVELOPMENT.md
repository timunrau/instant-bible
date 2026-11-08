# Development and deployment

For reader features and getting started, see the [README](../README.md). Commands below run from the repository root.

## Local development

Requires Node.js 24+ and npm. No backend, account, API key, database, or Docker is needed for development.

```bash
npm install
npm run dev
```

Open the address Vite prints. Production preview: `npm run build && npm run preview`. PWA/offline behavior is enabled in production builds; development uses Vite normally.

## Checks

```bash
npx playwright install chromium
npm run check
```

Checks run directly on your machine without Docker. `check` runs lint, strict types, BSB validation, unit/components, and the browser suites. It checks types once and builds once for root hosting and once for Pages, checking the JavaScript budget for each build. macOS also compares the committed visual baselines; other platforms explicitly skip the visual suite.

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Strict TypeScript and Vue types |
| `npm run test` | Unit/component specifications |
| `npm run test:watch` | Watch unit/component tests |
| `npm run test:e2e` | Fresh root build and JS budget, then desktop/mobile browser, offline, interaction tests; visual comparisons on macOS |
| `npm run test:pages` | Fresh Pages build and JS budget, then desktop/mobile hosting and offline tests |
| `npm run test:visual` | Fresh root build, then canonical screenshot comparisons on macOS |
| `npm run test:visual:update` | Fresh root build and deliberate macOS baseline regeneration; inspect all differences |
| `npm run screenshots` | Fresh root build and automatic capture of the three mobile README screenshots |
| `npm run bible:validate` | All BSB books/chapters/verses, omissions and SHA-256 checksums |
| `npm run bible:update-bsb` | Import pinned official BSB USJ locally, regenerate assets/index/fonts |
| `npm run build` | Production assets/PWA precache; run `typecheck` separately or use `check` |
| `npm run bundle:check` | Fail above 75 KiB gzipped application JS |
| `npm run icons:generate` | Rebuild favicon/PWA/Apple icons from SVG master |

BSB assets, metadata, and the unchanged official USJ source archive are committed. Builds and the development updater work without network access. The updater verifies `sources/bsb/provenance.json` against the archive, preserves source structure, and records canonical verse omissions without inventing text. To update the edition, deliberately replace the archive from the publisher's downloads page, record its URL/retrieval date/checksum, run the updater, and review content differences before accepting the generated assets. See [source review](SOURCE_REVIEW.md). Attribution/license details live in reader settings. Fonts are bundled under the SIL Open Font License.

macOS is the only visual baseline environment, with 18 reference images covering desktop and mobile. Compare them locally with `npm run test:visual`. For deliberate updates, run on your Mac:

```bash
npm run test:visual:update
```

Review every changed baseline before committing. Linux CI runs the functional suites without screenshot comparisons or baseline generation. Offline tests install the production service worker, disable the browser network, and navigate/reload unseen BSB passages.

README screenshots are separate from regression baselines. Whenever the UI changes, run `npm run screenshots`, review the three generated mobile PNGs in `docs/screenshots`, and include them with the change. The command builds production, manages its own preview server, and captures the reader, reference editor, and settings in a fresh light-theme phone context. Keep README screenshots mobile-only, in one theme, with standard Markdown image embeds.

The app JS budget excludes Bible/font/static assets and generated service-worker code. The BSB-only reader uses only generated local Scripture data; current output is approximately 43 KiB gzip against a 75 KiB limit.

## Self-hosting with Docker

Requires Docker with Compose. Clone the repository and start it; Compose builds the production image locally:

```bash
git clone https://github.com/timunrau/instant-bible.git
cd instant-bible
docker compose up -d
```

Open `http://localhost:8080`. Set `BIBLE_PORT` to override port 8080. The service restarts unless stopped. To update after pulling changes:

```bash
git pull
docker compose up -d --build
```

The multi-stage image builds with Node 24 and serves static files through nginx-alpine. `/healthz` returns `ok`; Docker monitors it. Deep links fall back to the SPA. HTML, manifest and service worker use no-cache headers; hashed JS/CSS and content-addressed BSB assets have immutable one-year caching. Browser theme colors follow the current theme. New workers do not forcibly reload an active reader.

## GitHub Pages and CI

The app is also hosted at [Instant Bible on GitHub Pages](https://timunrau.github.io/instant-bible/). Successful pushes to `main` deploy Pages after all checks pass. Repository **Settings → Pages → Source** must be **GitHub Actions** (already configured). The workflow obtains the deployment base from Pages, including custom-domain deployments.

`npm run build:pages` builds `dist` for `/instant-bible/`; set `BASE_PATH=/` when building for a custom domain at the root. Bible requests, navigation/share URLs, icons, fonts, manifest and service worker use the deployment base. Docker builds continue to use `/`.

Pages serves `404.html` (a copy of the reader shell) for direct passage links without a redirect. First-time deep-link requests have HTTP status 404 but open the requested Scripture normally; after installation, the service worker serves the shell for navigation and offline reloads. Pages controls HTTP cache headers; the nginx-specific headers and `/healthz` apply only to Docker hosting. `npm run test:pages`, also included in `npm run check`, verifies desktop/mobile direct links against a static Pages-style server, BSB selection links, history, and offline restarts.

Full CI runs on pushes to `main` and PR opens, code updates, and reopens. PR edits run only commit/title validation in a separate concurrency group, so editing metadata cannot cancel active code checks. Feature-branch pushes do not start a duplicate workflow alongside the PR run.

The check job runs directly on GitHub's Linux runner with Node 24, `npm ci`, `npx playwright install --with-deps chromium`, and `npm run check`. It runs functional, offline, Pages-hosting, data, build, and bundle-budget checks; visual comparisons stay local to macOS. CI does not build or test Docker containers and publishes only the Pages site. Self-hosting builds its image directly from the checkout.

## Releases

All new commits and PR titles use Conventional Commits. `npm ci` installs the local commit-message hook; `npm run commits:check` validates commits since the last legacy commit (`9b3e387`), with one exact-hash exception for the already-pushed README correction `715fda5`. New commits keep the full Conventional Commit rules. CI also checks PR titles so squash merges retain a valid release type. Existing history is kept intact.

After checks pass on `main`, CI runs semantic-release with the same plugin set as rum1n8. It seeds `v0.1.0` at the last legacy commit on its first run, then uses `fix:`/`perf:` for patch releases, `feat:` for minor releases, and `!`/`BREAKING CHANGE:` for major releases. `refactor:`, `build:`, and `chore(deps):` also trigger patches. Documentation, test, and CI-only changes do not bump the version. Versions are automatic; do not edit them manually.

CI commits `package.json`, `package-lock.json`, and `CHANGELOG.md`, tags the release, and creates GitHub release notes. Pages builds from that exact versioned commit. Release commits use `[skip ci]` to avoid loops. The repository’s Actions token needs permission to push release commits/tags to `main`; branch protection must allow that. Nothing is published to npm.

## Architecture and durable contracts

Vue 3 + strict TypeScript + Vite, plain CSS, Vitest/Vue Test Utils, and Playwright. Small pure modules handle references, URLs, ordering, clipboard prose and persistence. Semantic nodes are rendered by Vue; source HTML is normalized through an allowlist and never inserted with `v-html`. The reader uses a bounded stable chapter window and semantic verse anchors for persistence/history/typography. The service worker precaches the immutable bundled BSB assets; localStorage contains only settings/position. Legacy optional-translation caches are cleaned up in the background. There is no IndexedDB or heavyweight state library.

Read [PRODUCT_SPEC](PRODUCT_SPEC.md), [source review](SOURCE_REVIEW.md), [AGENTS.md](../AGENTS.md), and the human-readable tests in `tests/unit` and `tests/e2e` before changing behavior. Scope stays limited to reading, passage navigation, temporary selection, copy/share, and reader settings.

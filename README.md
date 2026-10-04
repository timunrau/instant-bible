# Instant Bible

A deliberately minimal, fast, offline-first Bible reader. The installed PWA is **Bible**. Scripture owns the screen: tap the bottom reference, type a passage, press Enter. Real Berean Standard Bible text is bundled; permitted optional English translations download as complete Bibles.

Application code is licensed under [MIT-0](LICENSE). Scripture, bundled fonts, and dependencies retain their own licenses; Scripture attribution is available in reader settings, and font licenses are bundled in `public/fonts`.

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

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | Strict TypeScript and Vue types |
| `npm run test` | Unit/component specifications |
| `npm run test:watch` | Watch unit/component tests |
| `npm run test:e2e` | Desktop/mobile browser, offline, interaction, visual tests |
| `npm run test:visual` | Canonical screenshots |
| `npm run test:visual:update` | Deliberate baseline regeneration; inspect all differences |
| `npm run bible:validate` | All BSB books/chapters/verses, omissions and SHA-256 checksums |
| `npm run bible:update-bsb` | Fetch official BSB HTML, normalize, regenerate assets/index/catalog/fonts |
| `npm run build` | Typecheck and production build/PWA precache |
| `npm run bundle:check` | Fail above 75 KiB gzipped application JS |
| `npm run icons:generate` | Rebuild favicon/PWA/Apple icons from SVG master |

BSB assets and metadata are committed. Normal CI/builds never contact fetch(bible). Only the updater and optional translation installation need its network API. The updater uses supported `FetchClient`/`BibleBookHtml.get_chapter()` interfaces. It preserves source structure and records canonical verse omissions without inventing text. Attribution/license details live in reader settings. Fonts are bundled under the SIL Open Font License.

Visual baselines include macOS and Linux. For CI-matching updates:

```bash
docker build -f Dockerfile.test -t instant-bible:test .
docker run --rm -v "$PWD/tests/e2e/visual.spec.ts-snapshots:/app/tests/e2e/visual.spec.ts-snapshots" instant-bible:test npx playwright test visual --update-snapshots
docker run --rm instant-bible:test
```

Review screenshots before committing. Tests mock optional-download transport with real BSB data; those fixtures do not claim to be another translation's text. Offline tests install the production service worker, disable the browser network, and navigate/reload unseen BSB passages.

The app JS budget includes the lazy fetch(bible) client, excludes Bible/font/static assets and generated service-worker code, and is intentionally strict: current output is approximately 55 KiB gzip against a 75 KiB limit.

## Production Docker

```bash
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t instant-bible:local .
docker run --rm -p 8080:80 instant-bible:local
```

The multi-stage image builds with Node 24 and serves static files through nginx-alpine. `/healthz` returns `ok`; Docker monitors it. Deep links fall back to the SPA. HTML, manifest and service worker use no-cache headers; hashed JS/CSS and content-addressed BSB assets have immutable one-year caching. Browser theme colors follow the current theme. New workers do not forcibly reload an active reader.

To deploy the published image:

```bash
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d
```

Set `BIBLE_PORT` to override port 8080. Compose pulls `ghcr.io/timunrau/instant-bible:latest`, restarts unless stopped, and opts into Watchtower via `com.centurylinklabs.watchtower.enable: "true"`. Run Watchtower in your separate central stack with `WATCHTOWER_LABEL_ENABLE=true`; this repository defines no Watchtower service.

## GitHub/GHCR

The app is also hosted at [Instant Bible on GitHub Pages](https://timunrau.github.io/instant-bible/). Successful pushes to `main` deploy Pages after all checks pass, independently of image publication. Repository **Settings → Pages → Source** must be **GitHub Actions** (already configured). The workflow obtains the deployment base from Pages, including custom-domain deployments.

`npm run build:pages` builds `dist` for `/instant-bible/`; set `BASE_PATH=/` when building for a custom domain at the root. Bible requests, navigation/share URLs, icons, fonts, manifest and service worker use the deployment base. Docker builds continue to use `/`.

Pages serves `404.html` (a copy of the reader shell) for direct passage links without a redirect. First-time deep-link requests have HTTP status 404 but open the requested Scripture normally; after installation, the service worker serves the shell for navigation and offline reloads. Pages controls HTTP cache headers; the nginx-specific headers and `/healthz` apply only to Docker hosting. `npm run test:pages`, also included in `npm run check`, verifies desktop/mobile direct links against a static Pages-style server, optional installs, history, and offline restarts.

The public-repository workflow runs `npm ci` and all quality gates in `Dockerfile.test` so browser and font rendering match the Linux visual baselines, then verifies production container health, deep links, and cache headers. Only a successful push to `main` publishes `linux/amd64` and `linux/arm64` images tagged `latest` and the full immutable commit SHA. Official Docker actions authenticate with the repository's `GITHUB_TOKEN`, using `packages: write` and `contents: read`; no PAT is needed.

After publishing this local repository to GitHub and the first successful image publication, open your **instant-bible package → Package settings → Change visibility → Public** so production can pull anonymously. If GitHub requires approval, ensure repository Actions has package write access. No remote repository or image is created by local checks.

## Architecture and durable contracts

Vue 3 + strict TypeScript + Vite, plain CSS, Vitest/Vue Test Utils, and Playwright. Small pure modules handle references, URLs, ordering, clipboard prose and persistence. Semantic nodes are rendered by Vue; remote HTML is normalized through an allowlist and never inserted with `v-html`. The reader uses a bounded stable chapter window and semantic verse anchors for persistence/history/typography. Cache Storage stores optional immutable Bible data with a final whole-Bible metadata marker; localStorage contains only settings/position. There is no IndexedDB or heavyweight state library.

Read [PRODUCT_SPEC](docs/PRODUCT_SPEC.md), [source review](docs/SOURCE_REVIEW.md), [AGENTS.md](AGENTS.md), and the human-readable tests in `tests/unit` and `tests/e2e` before changing behavior. Scope stays limited to reading, passage navigation, temporary selection, copy/share, and reader settings.

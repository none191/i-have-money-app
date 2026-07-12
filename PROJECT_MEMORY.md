# I Have Money Project Memory

## Current State
- Static Mobile Web App / PWA for personal income and expense tracking.
- Data is stored locally in `localStorage`, separated by user email.
- Login/Register are local prototype flows, not real server auth.
- Supabase is no longer part of the active product direction.
- Google Login uses Google Identity Services when `google.config.js` exists.
- Google Drive Sync uses `https://www.googleapis.com/auth/drive.appdata` and stores `i-have-money-backup.json` in the user's appDataFolder.
- Backup/restore uses a local JSON file through the browser.
- The UI now supports both mobile and desktop widths. Desktop uses wider responsive grids, while mobile keeps a single-column flow with no horizontal page overflow.
- Menu and top action icons use local SVG assets from `icons/menu/`; emoji remain only for legacy category icons and transaction/category labels.
- Auth/Login/Register uses a light cozy Auth-specific palette even when app dark mode is active.
- Auth/Login/Register visual direction is minimal-first: one light form card, no heavy hero card, very soft border/shadow, cozy only as a warm tint.
- Favicon and PWA app icons use the minimal cozy v5 icon set: `icons/favicon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, and `icons/apple-touch-icon.png`.
- Auth page keeps `theme-color` at `#faf7f1`; app views can still use the active brand color after login.
- Button system is minimal-first: compact `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-subtle`, `.btn-danger`, `.btn-sm`, and `.btn-compact` classes map old button classes into a lighter hierarchy.
- Desktop Settings layout uses a compact 46/54 two-column grid: Theme/Sync/Account on the left, category manager on the right with only the list scrolling; top spacing and desktop bottom nav are intentionally tight.
- Auth/Login/Register brand logo uses `icons/login/login-brand-transparent.png` to avoid the checkerboard/boxed background from the source PNG.
- Login brand logo is sized at 360×355 px (resized from 1105×1089 in Phase 2 cleanup); original non-transparent PNGs have been removed.
- Without `google.config.js`, the Google button stays disabled with "ยังไม่ได้ตั้งค่า Google Client ID"; email/password and demo login continue.
- `restoreFromBackupPayload()` always asks for confirmation before overwriting local data, and warns separately if the backup belongs to a different Google account. It returns `boolean` so callers know whether a restore actually happened.
- Test runtime: `node --test` (no external dependencies), see `package.json`. `npm test` runs the JS unit test suite (`tests/*.test.mjs`); `npm run test:smoke` runs `tests/nginx-docker-smoke.sh` (nginx config + docker compose config validation, plus a live container check when a Docker daemon is reachable).
- Pure, DOM-free logic that previously lived inline in `app.js` is now split into `lib/*.mjs` ES modules, each unit-testable under `node --test` and also loaded in the browser via `<script type="module">` + a `window.IHM_*` bridge object (since `app.js` itself stays a classic, non-module script for backward compatibility): `lib/backupSchema.mjs` (backup validation/normalization/version migration), `lib/storageSafety.mjs` (QuotaExceededError classification, storage-usage estimation, snapshot/restore for rollback), `lib/swPolicy.mjs` (service worker fetch classification + caching strategy, imported directly by `service-worker.js`, a module worker), `lib/csvExport.mjs` (CSV formula-injection-safe cell escaping).
- `index.html` loads `lib/backupSchema.mjs` and `lib/storageSafety.mjs` and `lib/csvExport.mjs` as `<script type="module">` BEFORE `app.js`, and `app.js` itself has `defer` added so it reliably executes after those modules populate their `window.IHM_*` bridges (module scripts are deferred-by-default regardless of position; a plain classic script without `defer` would otherwise run first and find the bridges undefined).
- `localStorage.setItem` is never called directly anywhere in `app.js` — always through `safeSetItem()`, which catches the synchronous `QuotaExceededError` and reports a clear message via `reportStorageWriteFailure()` instead of letting the exception abort whatever was writing.
- "Auto Local Backup" is now called "จุดคืนค่า" (restore point) in the UI, since it lives in the same localStorage/quota as the main data and is not an off-device backup. The underlying storage key (`AUTO_LOCAL_BACKUP_KEY`) is unchanged for backward compatibility. Settings has a recovery panel listing up to 5 restore points with one-click restore, plus a live storage-usage indicator.
- `service-worker.js` is registered with `{ type: "module" }` and imports `lib/swPolicy.mjs` to classify every fetch (cross-origin / navigation / static-asset / other) before deciding a caching strategy. Cross-origin requests (Google APIs) are never intercepted. Only navigations get the offline `index.html` shell fallback — static assets and any other same-origin request fail naturally instead. `self.skipWaiting()` is no longer automatic; a new worker waits until the user clicks the update banner's reload button.
- nginx now sends `Content-Security-Policy-Report-Only` (not yet enforcing) plus `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` on every response, via a shared `nginx-security-headers.conf` snippet `include`-d inside every `location` block (a location with its own `add_header` — all of ours set `Cache-Control` — stops inheriting server-level `add_header` directives in nginx, so the snippet has to be re-included per-location). `index.html`, `manifest.webmanifest`, `service-worker.js`, and `google.config.js` are all `no-cache`/`no-store`. Dotfiles (`.git/`, etc.) and `.md`/`.sql`/`.yml`/`.yaml` files are denied, since docker-compose mounts the whole repo as the nginx web root.
- `docker-compose.yml` is the generic/portable base; `docker-compose.nas.yml` is a NAS/production override applied via `-f docker-compose.yml -f docker-compose.nas.yml` (pinned nginx version, healthcheck, logging rotation, `no-new-privileges`). Neither file hard-codes an absolute NAS path — both use relative paths, which resolve correctly to whatever directory `docker compose` is run from.

## Decisions
- Google Client ID lives in local `google.config.js`; the app UI does not collect provider secrets or folder IDs.
- Client-side validation is only a guardrail. Any future real sync/auth/budget rules must be enforced by a server/domain service.
- Service worker precache uses `cache: "reload"` to avoid installing a new cache from stale HTTP 304 responses after asset changes.
- User-controlled category names and icons are escaped before rendering in any `innerHTML` surface.
- Stylesheet URLs can be versioned in `index.html` when responsive or cache-sensitive CSS changes must bypass older PWA/browser caches.
- When JS mutates a button that contains an icon image, update ARIA/title state instead of replacing `textContent`, or the icon node will be removed.
- New image assets used in first-screen UI should be added to service worker precache and verified in browser with `naturalWidth > 0`.
- Auth color variables are intentionally independent from the main app dark palette so `body.dark` does not make Login/Register heavy or low contrast.
- Never commit `google.config.js`; keep OAuth Client ID config local even though it is a public browser identifier.
- `restoreFromBackupPayload()` must always be called through a caller that has already asked the user for confirmation. The function returns `boolean` (`false` = user cancelled or email mismatch rejected) so callers can suppress any success message when restore did not occur.
- Orphaned or duplicate image assets (non-transparent login brand PNG, root icon SVGs) should be removed rather than kept to avoid ambiguity and cache bloat. Grep the entire project before deleting any asset file.
- Pure, DOM-free logic (validation, storage-error classification, fetch-strategy selection, CSV escaping) belongs in `lib/*.mjs`, not inline in `app.js`, specifically so it can be exercised by `node --test` without a browser. `app.js` and `service-worker.js` call into these modules rather than duplicating their logic.
- `restoreFromBackupPayload()` must validate + normalize the entire incoming payload in memory before writing anything to `localStorage`, and must reject the whole file if any single transaction fails validation rather than importing a partial/"best effort" subset.
- Any multi-key `localStorage` write sequence that represents one logical operation (e.g. restore) must snapshot the affected keys first and write the snapshot back if any write in the sequence fails — `localStorage` has no real transactions, so this is explicitly a best-effort compensating action, not an atomic guarantee, and user-facing messages should say so rather than implying a stronger guarantee than what's actually possible.
- CSP changes ship as `Content-Security-Policy-Report-Only` first; only move to enforcing `Content-Security-Policy` after confirming (with a real `google.config.js`, on a host with network access to Google's domains) that Google Login and Google Drive sync still work end-to-end.
- Do not enable `read_only: true` or a non-root user for the nginx container without first testing against UGREEN UGOS's Shared Folder ACL behavior on a disposable container — never run `chmod`/`chown` against the production NAS path to make a hardening change "just work."

## Data Contracts
- Backup JSON includes `transactions`, `budgets`, `categories`, `categoryIcons`, `settings`, `preferences`, safe public `user` profile info, and `exportedAt`/`updatedAt`.
- Backup JSON must not include password hashes.
- `settings.syncMode` is normalized to one of `local` or `google-drive`.
- Backup payload `version` is tracked as `BACKUP_SCHEMA_VERSION` in `lib/backupSchema.mjs` (currently `1`). A payload with no `version` field is treated as version 0 (legacy) and migrated automatically; a payload declaring a version *higher* than `BACKUP_SCHEMA_VERSION` is rejected outright rather than guessed at.
- Every transaction in a restored backup must pass `validateTransaction()`: non-empty string `id`; `type` exactly `"income"` or `"expense"`; `date` matching `YYYY-MM-DD` and representing a real calendar date; `amount` a finite number `> 0`; non-empty, non-reserved-key `category`; `receipt` a string when present. The whole file is rejected (not partially imported) if any transaction fails.
- Budget keys and category names reject reserved object keys: `__proto__`, `prototype`, `constructor` (`isReservedKey()` in `lib/backupSchema.mjs`, and `safeJsonParse()` strips them at every JSON nesting level as defense-in-depth during parsing itself).
- Restoring a backup only overwrites `preferences`/`settings` in `localStorage` if the incoming file actually declares that field — an omitted field must leave the current value untouched, not reset it to blank defaults.

## Learning Capture

### CSS details disclosure bug
- what: Advanced Sync fields were still visible even when `<details>` was closed.
- root cause: Custom `.settings-grid { display: grid; }` styling overrode the browser's default closed-details hiding behavior.
- correct: When styling content inside `<details>`, set the content hidden by default and explicitly show it with `[open]`, then verify computed style in browser.

### Service worker stale precache
- what: New HTML/CSS changes were not reliably visible after reload even after bumping cache name.
- root cause: `cache.addAll(ASSETS)` could reuse HTTP cached 304 responses during install, leaving the new service worker cache incomplete or stale.
- correct: Precache with `new Request(asset, { cache: "reload" })` whenever asset freshness matters, and verify server logs show 200 for updated assets.

### Responsive form overflow
- what: The Add Transaction form could become wider than its card on mobile, especially date/file/category controls and category chips.
- root cause: Grid/flex children did not consistently use `min-width: 0`, and chip controls used horizontal scrolling that visually extended past the card edge.
- correct: For mobile forms, set `min-width: 0` on grid/flex parents and children, keep controls at `max-width: 100%`, wrap chip controls, and verify `documentElement.scrollWidth <= clientWidth` on mobile and desktop.

### SVG icon cache and mutation
- what: After switching top buttons to SVG, the dark-mode icon disappeared in browser testing.
- root cause: A cached `app.js` still assigned `themeToggle.textContent`, replacing the `<img>` element.
- correct: Version both CSS and JS URLs for visual asset changes, precache the matching versioned URLs, and avoid using `textContent` on controls that contain icon nodes.

### Google Drive auth fallback
- what: Google Login must not break the existing local email/password and demo flows.
- root cause: OAuth and Drive sync depend on external config, provider setup, and network state that may not exist during local/offline use.
- correct: Load Google Identity Services only when `google.config.js` is present, keep the Google button disabled otherwise, keep localStorage as the primary offline store, and never overwrite local/Drive data without asking the user.

### Supabase archive
- what: Product direction changed from Supabase to Google Account + Google Drive only.
- root cause: Data ownership should follow the user's Google account and live in the user's Drive appDataFolder.
- correct: Keep Supabase out of active runtime/config/UI, archive historical schema under `docs/archive/`, and avoid reintroducing Supabase docs or keys unless the product direction changes again.

### Restore overwrites data without user confirmation
- what: `restoreJson()` called `restoreFromBackupPayload()` immediately on file selection with no `confirm()`, making it easy to accidentally overwrite all local data.
- root cause: Guard was missing on the local JSON restore path while the Google Drive restore path already had one.
- correct: Add `confirm()` before any call to `restoreFromBackupPayload()`, matching the Drive flow. Also add a separate `confirm()` inside `restoreFromBackupPayload()` itself if the backup email does not match the currently logged-in account.

### Large unused image assets in repo
- what: `icons/login/login-brand.png`, `icons/menu/login-brand.png` (~1.4 MB each) and root `icon.svg`/`icon-maskable.svg` were committed but never referenced by any HTML/JS/CSS/manifest.
- root cause: Assets were added or superseded across versions without removing the originals.
- correct: Before deleting any asset, run `grep -rn <filename>` across all source files. Only delete when no real reference remains (README/doc mentions alone do not count as live references).

### localStorage.setItem throws synchronously, it does not fail silently
- what: An earlier findings pass initially assumed `localStorage.setItem` would "return silently" when storage is full.
- root cause: It actually throws a synchronous `QuotaExceededError` `DOMException` immediately, which is worse than silent failure if uncaught — it aborts whatever function was mid-write, potentially leaving app state half-updated.
- correct: Every `localStorage.setItem` call must go through a wrapper (`safeSetItem()` / `lib/storageSafety.mjs`'s `trySetItem()`) that catches this and reports it, never call `setItem` directly.

### Module scripts execute after classic scripts regardless of source order
- what: Adding `<script type="module" src="lib/backupSchema.mjs">` before `<script src="app.js">` in `index.html` did not guarantee `window.IHM_BACKUP_SCHEMA` existed by the time `app.js` ran.
- root cause: Module scripts are deferred-by-default per the HTML spec; a classic script with no `defer`/`async` executes immediately when the parser reaches it, which happens before the document finishes parsing and before any deferred/module script runs — regardless of which one appears first in the source.
- correct: Add `defer` to the classic script too, so all of them execute in document order after parsing completes. Verified safe here because `app.js` already gated its `init()` on `DOMContentLoaded`, which always fires after deferred scripts run.

### nginx add_header does not merge across nested blocks the way you'd expect
- what: Security headers (`X-Content-Type-Options`, `Content-Security-Policy-Report-Only`, etc.) declared once at the `server` level silently disappeared on every response, even though `nginx -t` reported no error.
- root cause: nginx only inherits `add_header` directives from a parent block if the current block (e.g. a `location {}`) has *no* `add_header` of its own. Every location here also sets its own `Cache-Control` via `add_header`, which silently discarded all the server-level security headers for that location — this is "all or nothing" inheritance per block, not a per-header merge.
- correct: Put shared headers in an external snippet file and `include` it inside every `location` block that also sets its own `add_header`, so they're re-declared in that block's own scope. Verified with `curl -D -` against a real nginx process, not just `nginx -t` (which does not catch this class of bug — the config is syntactically valid either way).
## Next Steps
- Replace prompt-based Drive conflict resolution with an in-app modal.
- Split receipt images into separate Google Drive files and store `fileId` in JSON when backup size becomes an issue.
- Add automated browser tests for Google config missing state, JSON backup/restore, Drive button states, category escaping, and service worker cache refresh.
- Verify Google Login/Drive sync against the new Content-Security-Policy-Report-Only header with a real `google.config.js` on staging/NAS (could not be done in the review sandbox — no network egress to accounts.google.com/googleapis.com there), then flip CSP from Report-Only to enforcing.
- Migrate the three `style="..."` innerHTML injection sites (category report bars, budget bars, theme swatches) to `element.style.setProperty()` so `'unsafe-inline'` can be dropped from the CSP `style-src` directive.
- Introduce content-hashed filenames for static assets (e.g. `app.abc123.js`) so they can use `Cache-Control: public, max-age=31536000, immutable` instead of the current short revalidated cache — needs a small build/hash step since there is no bundler today.
- Expose the per-account `AUTO_LOCAL_BACKUP_KEY` rotation as truly per-user storage instead of a single global 5-slot buffer shared by every local account on one device/browser (see createRestorePoint's inline comment).
- Read `docs/receipt-storage-assessment.md` before starting any receipt-storage work — migrating receipts to IndexedDB is worth doing but is real scope (touches backup/restore and Drive sync formats), not a quick add-on.
- Test `read_only: true` + `tmpfs` for the nginx container against UGREEN UGOS's Shared Folder ACL behavior on a disposable container before enabling it in docker-compose.nas.yml (see that file's trailing comment block for the manual steps).

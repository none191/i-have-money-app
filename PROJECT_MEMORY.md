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
- Without `google.config.js`, the Google button stays disabled with "ยังไม่ได้ตั้งค่า Google Client ID"; email/password and demo login continue.

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

## Data Contracts
- Backup JSON includes `transactions`, `budgets`, `categories`, `categoryIcons`, `settings`, `preferences`, safe public `user` profile info, and `exportedAt`.
- Backup JSON must not include password hashes.
- `settings.syncMode` is normalized to one of `local` or `google-drive`.
- Google Drive backup payload version 1 includes `app`, `version`, `updatedAt`, safe `user`, `transactions`, `budgets`, `categories`, `categoryIcons`, and `settings`.
- Budget keys and category names reject reserved object keys: `__proto__`, `prototype`, `constructor`.

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

## Next Steps
- Replace prompt-based Drive conflict resolution with an in-app modal.
- Split receipt images into separate Google Drive files and store `fileId` in JSON when backup size becomes an issue.
- Add automated browser tests for Google config missing state, JSON backup/restore, Drive button states, category escaping, and service worker cache refresh.

# Receipt Image Storage: localStorage vs IndexedDB — Assessment

Status: **evaluation only, not implemented.** No backend added, no storage
migration performed. This document exists to inform a future decision.

## Current state

Receipt images are compressed client-side (`compressImage()`, resized to a
900px-wide JPEG at quality 0.72 before ever being stored — this already
existed and was not changed by this review) and stored as a base64 `data:`
URL string inside each transaction record, which lives in the
`transactions` array under a single localStorage key
(`..._transactions`). A single compressed receipt is typically
50–150 KB as a base64 string; a heavy user with hundreds of receipts could
plausibly accumulate several megabytes of receipt data inside one
localStorage value.

## Why this matters

- localStorage has a **synchronous** API and a **small quota** (traditionally
  ~5 MB per origin on most browsers, including iOS Safari — the primary
  target platform for this PWA per the project's own notes). Every
  transaction save round-trips the *entire* transactions array (including
  every embedded receipt) through `JSON.stringify` + `localStorage.setItem`.
  This review's `safeSetItem` wrapper (see the Critical-severity commit)
  stops that from crashing the app, but it does not stop the underlying
  problem: storage pressure from receipts is the single most likely cause
  of hitting the quota at all for a real user of this app.
- IndexedDB is **asynchronous**, has a **much larger** (browser-dependent,
  typically hundreds of MB to low GB) quota, and is designed for exactly
  this kind of binary/blob-ish data — it can store actual `Blob`/`File`
  objects directly instead of base64-inflated strings (base64 encoding
  itself adds ~33% size overhead that IndexedDB storing raw Blobs avoids
  entirely).

## What a migration would look like (not done here)

1. New object store, e.g. `receipts` keyed by transaction id, storing a
   `Blob` (the compressed JPEG) instead of a base64 string.
2. `transactions` in localStorage would keep a boolean/flag
   (`hasReceipt: true`) instead of the actual image data — this is already
   very close to today's shape (`Boolean(t.receipt)` is already used for
   the CSV export's `hasReceipt` column).
3. Reading a transaction's receipt for display becomes an async
   `indexedDB` read instead of a synchronous property access — every call
   site that currently does `item.receipt` for display (transaction list,
   receipt dialog) would need to become `await getReceiptBlob(item.id)`
   and use `URL.createObjectURL(blob)` for the `<img src>`.
4. **Backup/restore gets meaningfully more complex.** JSON backup files are
   text-only; a Blob can't be embedded in a JSON file directly. The backup
   payload would need to either (a) keep base64-encoding receipts *only*
   for the export/import path (converting Blob ↔ base64 at the
   backup/restore boundary), or (b) exclude receipts from JSON backups
   entirely and rely solely on Google Drive sync for receipt portability
   (which would be a behavior change / feature reduction users would need
   to be told about explicitly).
5. Google Drive sync (`buildBackupPayload` / `restoreFromBackupPayload`,
   both touched by this review) would need the same base64 ↔ Blob
   conversion at its boundary, since the Drive backup file is also plain
   JSON.
6. Safari/iOS has historically had IndexedDB reliability quirks in Private
   Browsing mode (silently very small or non-persistent) — needs explicit
   testing on the actual target platform before relying on it as the
   primary store for anything the user would be upset to lose.

## Recommendation

**Worth doing, but as a dedicated follow-up, not folded into this
safety/hardening pass.** The current localStorage-only approach is
functionally correct and now has proper quota-failure handling (this PR),
which meaningfully reduces the *severity* of hitting the limit (a clear
error and an intact rollback instead of silent corruption or a hard
crash). Moving receipts to IndexedDB would reduce *how often* a heavy user
hits that limit in the first place, but touches the backup/restore format,
the Drive sync format, and every receipt-display call site — real
scope, not a quick add-on. Suggested next step if the team wants to pursue
this: prototype the `receipts` object store + Blob storage in isolation
first (behind a feature flag or a separate branch), verify the
backup/restore Blob↔base64 boundary conversion round-trips correctly
(including through Google Drive), and specifically test iOS Safari Private
Browsing behavior, before touching the main branch.

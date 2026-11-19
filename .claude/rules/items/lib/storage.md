---
paths:
  - "src/lib/storage/**"
  - "src/config/lib/storage.config.ts"
---
# lib/storage
what: engine-independent file storage parts: storage:// refs, display URLs, delivery rules, purposes (strip / keep), StoragePort + GCS, re-encoding, client upload | entries @/lib/storage, /server, /client | authz and the ledger live in storageObject
use: always
change: placement = src/config/lib/storage.config.ts (read TTLs, imageStrip) | add = storageObject purposes/<name>.ts or domain.json field.storage
rules:
using:
- through_base: every upload, read and delete goes through this base and storageObject
- display_helpers: public URLs come only from resolveStorageSrc | display parts use toStorageDisplaySrc
- strip_default (MANDATORY): image purposes default metadata "strip" (the server re-encodes, removing GPS / EXIF / XMP / IPTC / ICC), "keep" only when the original is needed (explicit) | user.avatar is always strip | public docs (privacy policy) name the strip purposes, never "all images"
- purpose_decides: callers never pass strip / keep | image shrinking is declared once per purpose, never on input parts | purposeId is never renamed
- upload_callsite: features / app UI never call uploadToStorage → MediaUploader parts or the domain's hook
- media_schema: media columns use storageMediaValueSchema, never z.string().url()
- legacy_three_uses: legacy URL helpers only for delete-on-row-delete, admin copy and admin probe
- private_media_src: private video / audio get the URL in the element's src attribute, never a <source> child | no page-wide re-sign mechanism
- cross_domain_cors: reading the bytes of a stored file from another origin (fetch for MSE / Web Audio) needs the bucket's CORS (pnpm ops storage setup)
editing:
- port_promises: writes never overwrite, issued objects are no-store, generation-bound ops stay bound, the port does no authz | a custom port has read
- inline_fixed: inline delivery is the fixed INLINE_CONTENT_TYPES table, no downstream addition
- no_fallback_bucket: never fall back to a default or legacy bucket
- strip_every_write: server writes and copies into a strip image purpose re-encode every time
read: flow → Overview | display, upload, shrink → Usage | strip / keep promise, shrink spec, config → Extension | ref, port, stores, purpose type → src/lib/storage/API.md API | re-encode, recovery, upload transport → src/lib/storage/Internals.md Internals

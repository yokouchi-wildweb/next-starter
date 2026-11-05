# DOWNSTREAM NOTICE id:20261105-122620-media-upload-failure-blocks-submit
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T12:26:20+09:00
severity: action-required
checkpoint: media-upload-failure-blocks-submit
change: AppForm now refuses to submit while any registered field reports a failed background upload (toast "アップロードに失敗した項目があります…"; the form stays enabled so the field can be retried or cleared). MediaUploader / MediaUploaderMulti gained an optional `onUploadFailedChange(failed)` (user cancel is not a failure); useMediaUploaderField / useMediaUploaderMultiField return `hasFailed`; MediaHandleEntry and MediaState gained optional `hasFailed`, which ConfiguredMediaField / ConfiguredMediaMultiField / ControlledMediaField / FieldRenderer now fill. Shared check: src/components/Form/backgroundFailure.ts.
why: Behavior changes silently: before, a failed upload restored the previous value and the form could be saved with it (often empty) without the user noticing. Forks that build their own MediaHandleEntry (registerMediaHandle / FieldRenderer onHandleChange) for an async field do not get the block until they return `hasFailed`.
required_actions:
1. Find fork code that registers its own entries: `git grep -n "registerMediaHandle\|onHandleChange" -- src ':!src/components/Form'`. For each entry built from an upload hook or an own async state, add `hasFailed: <true while the background work failed and has not been retried or cleared>` (from useMediaUploaderField / useMediaUploaderMultiField it is `mediaHandle.hasFailed`) and add it to the effect's deps.
2. If a fork screen wraps MediaUploader / MediaUploaderMulti outside AppForm and saves on its own button, decide whether that button should also refuse while `onUploadFailedChange` reported true (optional; same rule as AppForm).
verify: pnpm typecheck | pnpm test:form-background-failure | pnpm test:storage-client | in a form with a media field, make an upload fail (e.g. offline) → submit shows the toast and does not save; retry or clear the field → submit works.
manual_steps: -
refs: src/components/Form/AppForm.tsx, src/components/Form/backgroundFailure.ts, src/lib/mediaInputSuite/components/MediaUploader.tsx, src/lib/mediaInputSuite/components/MediaUploaderMulti.tsx, src/components/Form/README.md (メディアの自動コミット / 注意事項), order 20261105-070903-media-field-defaults-rest
notes: Not covered (own upload state, not AppForm entries): core AccountAvatarSection, PrepareProofImage, AdminNotificationSend. Media without validationRule are still capped server-side (purpose maxBytes in the signed URL); a cleared media field's form value is "" and generated schemas save it as null (required fields stop with the required message) — no change there.

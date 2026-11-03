# DOWNSTREAM NOTICE id:20261103-124908-media-failed-upload-restore
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T12:49:08+09:00
severity: info
checkpoint: media-failed-upload-restore
resolves: 20261101-160323-media-failed-upload-drops-stored-image
change: MediaUploader (src/lib/mediaInputSuite) restores the value it had before the pick when an upload fails or the overlay キャンセル stops it (onUrlChange(<previous value>), preview back to it, picker's selected file cleared). Before, picking set the value to null and a failure left it null, so an update form saved null over the stored image. The clear action still sets null. Late onError / onComplete of a canceled or superseded upload are ignored
why: info only: ControlledMediaUploader / ManualMediaUploader / useMediaUploaderField pass through unchanged, no fork code has to change
required_actions: none
verify: pnpm typecheck passes
manual_steps: -
refs: src/lib/mediaInputSuite/components/MediaUploader.tsx | src/lib/mediaInputSuite/README.md §2.2 | order 20261101-160323-media-failed-upload-drops-stored-image
notes: a fork whose onUrlChange handler assumed "failure leaves null" (none known) now receives the previous value once more after a failure. Not run in a browser: verified by code path and typecheck only. MediaUploaderMulti is not changed (out of this order)

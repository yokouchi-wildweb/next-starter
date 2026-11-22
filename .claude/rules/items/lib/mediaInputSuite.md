---
paths:
  - "src/lib/mediaInputSuite/**"
---
# lib/mediaInputSuite
what: media input parts and hooks: metadata, preview and upload to src/lib/storage (MediaInput, MediaUploader, MediaUploaderMulti, MediaThumbGrid, MediaPreview, usePendingMediaUploads …) and their react-hook-form adapters in formAdapters/ (ControlledMediaUploader, useMediaUploaderField, ManualMediaUploader …)
  - closed lib: one entry @/lib/mediaInputSuite (parts, hooks, adapters, types, helpers), shelf @/components as peers
use: always
change: none → /order <direct parent>
rules:
using:
- mis_upload_via_parts: UI parts of domains and app never call uploadToStorage directly (domain hooks may) | forms upload through these parts (or FieldRenderer / the formAdapters)
- mis_purpose: an uploader takes a registered purpose `<domain>.<field>` | no path, no strip / keep and no shrink option on the part (the purpose declares them)
- mis_helper_text: size and shrink notes go in the field's helperText with the purpose's image.maxDimension numbers, never inside the part
- mis_reencode: reencodeImage is never counted as the metadata-removal guarantee
- mis_commit: call commit() after the business save succeeds, reset() to drop the edit
- mis_no_client_delete: adopted files are never deleted from the client | replacing or clearing + the business save detaches them on the server
editing:
- mis_value_restore: the value is a storage ref | a failed or cancelled upload restores the previous value, never a silent null | clearing does not restore
- mis_user_changes_only: onUrlsChange fires only on user actions, never on mount or a new initialUrls
- mis_discard_own_refs: discard sends only storage refs uploaded in this session, never old URLs or saved values
- mis_guard_entry: the in-flight guard reads @/lib/unsavedGuard by its entry only | saved-pending values are the form's guard, not this lib's
- mis_form_adapters_no_suite: formAdapters/ read only react-hook-form types and this lib (relative paths), never @/lib/formSuite | formSuite reads this lib, not the reverse
- mis_video_via_appvideo: VideoPreview draws the video through Media/AppVideo (the private-file recovery lives there) | no <video> or recovery wiring here
read: which part, form wiring, commit / reset → Usage | parts and hooks → API | upload vs save, guard, checks → Internals | storage → Related

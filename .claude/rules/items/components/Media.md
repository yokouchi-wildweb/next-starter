---
paths:
  - "src/components/Media/**"
---
# components/Media
what: image and video display parts: AppImage (@/components/Media/AppImage, the next/image wrapper: fill / intrinsic modes, sizes presets, fallback, storage:// refs, crash guard) and PreviewImage (@/components/Media/PreviewImage, one plain img for a just-picked image) and AppVideo (@/components/Media/AppVideo, the one <video>: storage:// refs, private-file recovery with the failed row and 再開)
use: always
change: none → /order <direct parent>
rules:
using:
- fill_box: content images of unknown size → fill mode, the caller passes the aspect box as className | never wrap it in an own relative box + absolute img (the box folds into AppImage)
- intrinsic_assets: assets of known size (logo, icon) → mode="intrinsic" with width / height
- lcp_priority: priority only on the LCP image (the main first-view image)
- optimize_override: unoptimized={false} only for a host the fork added to remotePatterns | otherwise leave the automatic judgment
- video_part: a video of an app file → AppVideo | never a raw <video> with its own usePrivateMediaRecovery wiring (a player AppVideo cannot be = the one exception, wired as src/lib/storage/Internals.md says)
- preview_scope: PreviewImage only for a just-picked or local image (blob: URL, signed URL) | public and user images → AppImage
editing:
- private_unoptimized: fixed URLs to /api/storage/ always stay unoptimized, whatever the prop (authorized images never enter the optimization cache)
read:
- AppImage: which mode, migrate from img → src/components/Media/AppImage/README.md Usage | props, sizes presets → src/components/Media/AppImage/README.md API | remotePatterns, optimization flag → src/components/Media/AppImage/README.md Extension | storage refs, crash guard → src/components/Media/AppImage/README.md Internals
- PreviewImage, AppVideo: preview → src/components/Media/PreviewImage/README.md Overview | video props, refs → src/components/Media/AppVideo/README.md API | recovery, failed row → src/components/Media/AppVideo/README.md Internals

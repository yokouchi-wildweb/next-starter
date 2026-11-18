---
paths:
  - "src/components/Media/**"
---
# components/Media
what: image display parts: AppImage (@/components/Media/AppImage, the next/image wrapper: fill / intrinsic modes, sizes presets, fallback, storage:// refs, crash guard) and PreviewImage (@/components/Media/PreviewImage, one plain img for a just-picked image)
use: always
change: none → /order <direct parent>
rules:
using:
- fill_box: content images of unknown size → fill mode, the caller passes the aspect box as className | never wrap it in an own relative box + absolute img (the box folds into AppImage)
- intrinsic_assets: assets of known size (logo, icon) → mode="intrinsic" with width / height
- lcp_priority: priority only on the LCP image (the main first-view image)
- optimize_override: unoptimized={false} only for a host the fork added to remotePatterns | otherwise leave the automatic judgment
- preview_scope: PreviewImage only for a just-picked or local image (blob: URL, signed URL) | public and user images → AppImage
editing:
- private_unoptimized: fixed URLs to /api/storage/ always stay unoptimized, whatever the prop (authorized images never enter the optimization cache)
read: which mode, migrate from img → src/components/Media/AppImage/README.md Usage | props, sizes presets → src/components/Media/AppImage/README.md API | remotePatterns, optimization flag → src/components/Media/AppImage/README.md Extension | storage refs, crash guard → src/components/Media/AppImage/README.md Internals | preview → src/components/Media/PreviewImage/README.md Overview

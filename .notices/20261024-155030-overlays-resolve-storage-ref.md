# DOWNSTREAM NOTICE id:20261024-155030-overlays-resolve-storage-ref
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T15:50:30+09:00
severity: info
checkpoint: overlays-resolve-storage-ref
change: ImageViewer (openImage / ZoomableImage) and DetailModal (media.url and media.poster, image and video) now resolve storage:// refs to display URLs before rendering, like AppImage. The shared rule moved from AppImage's private helper to a new export toStorageDisplaySrc(value) in @/lib/storage/ref (ref → resolveStorageSrc; any other value, incl. blob: / data: previews and already-resolved URLs, is returned unchanged). No prop or signature change.
why: After the storage cutover, media values are storage:// refs; passing them to these overlays rendered <img src="storage://..."> and showed nothing. Forks that wrapped call sites with resolveStorageSrc can drop the wrappers.
required_actions:
1. Merge upstream.
2. Optional cleanup: find call sites that resolve before passing to these overlays — `grep -rnE "openImage\(|<ZoomableImage|<DetailModal" src --include=*.tsx` and look for `resolveStorageSrc(` in the passed value — and pass the stored value directly. Leaving the wrappers is harmless (an http(s) or "/" URL is not converted again).
3. When writing your own display component that takes a media value, use `toStorageDisplaySrc` from `@/lib/storage/ref` instead of `resolveStorageSrc` (the latter returns null for blob: / data: previews).
verify: `pnpm typecheck` passes | `pnpm test:storage-ref` passes | in the browser, enlarging a storage:// image (openImage / ZoomableImage) and opening a DetailModal with a storage:// media url both show the file
manual_steps: -
refs: src/lib/storage/ref.ts (toStorageDisplaySrc), src/components/Media/AppImage/source.ts, src/components/Overlays/ImageViewer/{Provider,ZoomableImage}.tsx, src/components/Overlays/DetailModal/{DetailModal,DetailModalVideo}.tsx, src/lib/storage/README.md (表示側の配線), src/components/Overlays/README.md
notes: Fork-specific impact: not checked.

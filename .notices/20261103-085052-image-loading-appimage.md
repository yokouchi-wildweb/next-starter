# DOWNSTREAM NOTICE id:20261103-085052-image-loading-appimage
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:(this commit)
date: 2026-11-03T08:50:52+09:00
severity: info
checkpoint: image-loading-appimage
resolves: 20261101-112939-image-loading-appimage
change: user BackgroundLayer and admin Header logos now render through AppImage (background = fill sizes="full" priority; admin logos = intrinsic 300x61 priority, w-auto/h-auto capped by the same max-* classes); raw img kept with decoding="async" (no lazy) in DetailModal, UnreadNotificationModal, PrepareProofImage, mediaInputSuite ImagePreview; createImageIcon and user header Brand unchanged
why: upstream takes oripa-do's image-loading order; no fork needs to follow up (oripa-do already reverted its copies and dropped the permit rows)
required_actions: none
verify: pnpm typecheck | pnpm test:admin-layout
manual_steps: -
refs: src/components/Media/AppImage/README.md | order 20261101-112939-image-loading-appimage
notes: DOM change: those imgs now carry data-component="AppImage" (+ srcset when IMAGE_OPTIMIZATION=enabled); fork CSS targeting `img` inside #header / the background layer still matches. Brand.tsx stays on direct next/image (already priority / optimized) because AppImage has no `id` prop and the logo keeps id="header-brand-logo"; adding a prop to a core part was out of this change. Modal / preview images are not lazy on purpose: they render only when visible, and ImagePreview waits for onLoad.

---
paths:
  - "src/lib/seamlessVideo/**"
---
# lib/seamlessVideo
what: seamless playback of pre-transcoded fmp4 fragments through MSE (SeamlessVideoPlayer, useSeamlessVideo, SeamlessSource), with audio by Web Audio (useSeamlessReel), format checks (validateFragments, validateReel) and reel manifests
  - closed lib: entries @/lib/seamlessVideo (playback, hooks, player, checks, manifest shape, reelManifestClient) and @/lib/seamlessVideo/server (manifest store in Firestore: saveManifest / getManifest / getLatestManifest)
use: always
change: none → /order <direct parent>
rules:
using:
- sv_input_format: inputs meet the input format rules (API); the lib never transcodes (ffmpeg or a video service makes them)
- sv_sources_memo: memoize `sources` (a new reference reloads)
- sv_gesture: call play() inside a user gesture, or call unlock() inside the gesture first when play() comes after an await
- sv_mse_check: without MSE the caller checks isMseSupported() and falls back itself
- sv_cors: URL sources on another domain need the bucket's CORS setup (docs/setup Storage の CORS 設定)
- sv_product_purpose: a product reel manifest uploads with a purpose attached to a business row (demo.media is swept after 24 h)
editing:
- sv_no_fixed_ui: no fixed loading UI; the hooks expose rich state and each project builds its UI
- sv_prefetch_cache: prefetch keeps no buffers of its own (browser HTTP cache)
read: play, check, reels → Usage | format rules, hook options → API | manifests, CORS → Extension | concat, sync, memory → Internals

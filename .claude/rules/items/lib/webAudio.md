---
paths:
  - "src/lib/webAudio/**"
---
# lib/webAudio
what: the app's shared Web Audio base: one shared AudioContext (AudioEngine, getSharedAudioEngine, unlockAudio), one-shot sound effects (playSe, preloadSe), loop sound effects (playLoopSe) and BGM (playBgm, duckBgm, crossfadeBgm …) over one decode cache | entry @/lib/webAudio
use: always
change: none → /order <direct parent>
rules:
using:
- shared_context: sound shares the one engine (getSharedAudioEngine); a feature never closes it on unmount
- unlock_in_gesture: call unlockAudio() once inside the first user gesture before the first sound
- url_from_caller: webAudio takes a URL (absolute URL or path); the caller resolves where the sound lives (e.g. sePath of @/utils/assets)
read: none (no README; the entry's comments: src/lib/webAudio/index.ts, src/lib/webAudio/loopSe.ts)

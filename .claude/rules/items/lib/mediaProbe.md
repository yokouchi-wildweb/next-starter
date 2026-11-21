---
paths:
  - "src/lib/mediaProbe/**"
---
# lib/mediaProbe
what: server-side probe of stored media (video / audio) returning facts about its streams (hasAudioTrack, container, duration, codecs), engine swappable
  - closed lib: entries @/lib/mediaProbe (result types, hasAudioTrack / isSilentVideo …) and @/lib/mediaProbe/server (probeMedia, registerProbeEngine / setDefaultProbeEngine, ProbeEngine; server-only, registers the default engine on import)
  - admin API POST /api/media/probe
use: always
change: none → /order <direct parent> | own engine = registerProbeEngine / setDefaultProbeEngine from @/lib/mediaProbe/server in own server code (→ Extension)
rules:
using:
- mp_facts_only: policy (allow / reject, 409, orphan deletion, duration limits) is the calling domain's; the lib returns facts only | the general rule = core/lib.md facts_not_policy
- mp_authorize_ref: for a managed storage:// file the caller authorizes the read and passes a short-lived authorizedUrl (the lib never resolves refs)
- mp_tracing_route: calling probeMedia outside API routes (SSR page, Server Action) adds that route key to outputFileTracingIncludes in next.config.ts
- mp_not_seamless: not for transcoded fmp4 fragments (src/lib/seamlessVideo/probe/ is the other tool)
editing:
- mp_wasm_path: mediainfoEngine.ts holds no .wasm string literal (the path is joined at run time) and next.config.ts outputFileTracingIncludes bundles the file: keep both dev (Turbopack) and production working
- mp_fetch_signal: every fetch in mediaSource gets a signal tied to the probe deadline, and never awaits the body cancel (Next tees signal-less GETs)
read: probe and handle results → Usage | admin API, limits → API | own engine → Extension | WASM, Range prefetch, pool → Internals

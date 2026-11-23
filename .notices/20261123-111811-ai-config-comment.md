# DOWNSTREAM NOTICE id:20261123-111811-ai-config-comment
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-111524-ai-config-comment-old-name | commit:(this commit)
date: 2026-11-23T11:18:11+09:00
severity: info
checkpoint: ai-config-comment
resolves: 20261119-111700-ai-config-comment-old-name
change: the comments of runAgent options in src/lib/ai/agent/types.ts name aiConfig instead of the old AI_AGENT_CONFIG, so the verify grep of notice 20261111-123916-lib-close-wave3-a (`git grep -nE "REALTIME_ROOM_CONFIG|AI_AGENT_CONFIG|realtime-room\.config" -- src scripts servers`) returns 0 hits on upstream
why: info only; a fork that saw only these upstream comment lines in that grep has nothing to do
required_actions: none
verify: git grep -nE "REALTIME_ROOM_CONFIG|AI_AGENT_CONFIG|realtime-room\.config" -- src scripts servers  (no hits, or only the fork's own lines)
manual_steps: -
refs: src/lib/ai/agent/types.ts, .notices/20261111-123916-lib-close-wave3-a.md, order 20261123-111524-ai-config-comment-old-name
notes: comment-only change

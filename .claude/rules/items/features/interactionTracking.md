---
paths:
  - "src/features/core/interactionTracking/**"
  - "src/config/features/interactionTracking.config.ts"
---
# features/interactionTracking
what: counts actions per content (target_type, target_id, action), anonymous users included: public ingest /api/interactions (+ /batch for impressions), interactionService on the server, lifetime and daily counters kept forever
use: interactionTracking
change: add → targetRules (extensionPoints.ts; an unlisted targetType is rejected) | placement → src/config/features/interactionTracking.config.ts
rules:
using:
- it_scope: only events that grow at the speed of a user's click | impressions → the batch ingest | streams or tens of millions a day → a separate pipeline (CLAUDE.md COUNTING NOT_for)
- it_batch_actions: batchActions never hold a one-press-one-count action such as click (the batch states its own counts)
- it_no_generic_insert: never insert through the generic CRUD (/api/interactionEvent): counters are not added
- it_vocab: the consuming domain names its action / source words
- it_fire_and_forget: trackInteraction is not awaited and never blocks the UI
- it_audience_view: audience lists and logged-in / anonymous splits come from details (within retention), totals from lifetime counters → a screen notes the gap | a recordDetail:false target shows "no breakdown", never 0 people
editing:
- it_user_from_session: the ingest takes userId from the session only, never from the client
- it_sharded_counters: hot counters stay sharded rows summed on read, no in-memory buffer
- it_no_ui: no UI here, the data layer only (screens are the fork's)
read: wire a target, track, show counts → Usage | server functions, admin API → API | tables, retention, shards → Internals | target rules → src/features/core/interactionTracking/targetRules/README.md Usage

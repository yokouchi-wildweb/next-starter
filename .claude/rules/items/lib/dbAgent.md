---
paths:
  - "src/lib/dbAgent/**"
  - "src/config/lib/dbAgent.config.ts"
---
# lib/dbAgent
what: data layer of the admin DB investigation agent (natural language → read-only PostgreSQL) on @/lib/ai: runDbAgent, POST /api/admin/db-agent (SSE), streamDbAgentChat; entries @/lib/dbAgent (client-safe), @/lib/dbAgent/server. No UI
use: always (off while DATABASE_URL_READONLY is unset: the API answers 503)
change: add → src/wiring/dbAgent/promptFragments | extraTools | suffixProviders (pnpm generate extensions) | placement → src/config/lib/dbAgent.config.ts, src/config/lib/ai.config.ts
rules:
using:
- dbagent_role: the readonly role runs all steps of Usage (incl. REVOKE CREATE ON SCHEMA public and the role-level read only) and passes the 3 checks
- dbagent_tools_readonly: extraTools are read-only operations; never register a writing tool
- dbagent_suffix_trusted: suffix providers return admin-authored text only, never end-user text, and no value that changes per request (keeps the prompt cache)
- dbagent_ui_events: a UI ignores unknown event `type` / `v` and shows loading before the stream starts
editing:
- dbagent_no_fallback: never fall back to DATABASE_URL; the secret's presence is the only on / off switch (no toggle env)
- dbagent_mask: masked columns come from the shared @/lib/audit denylist
- dbagent_no_ui: the lib ships no UI (screens are the fork's)
read: enable, readonly role, checks → Usage | entries, config, audit → API | wiring receptacles → Extension | safety layers, injection, suffix → Internals

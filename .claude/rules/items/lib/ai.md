---
paths:
  - "src/lib/ai/**"
  - "src/config/lib/ai.config.ts"
---
# lib/ai
what: the domain-free agent runtime for Claude API capabilities: system prompt + tools + history in, a tool loop streaming typed AgentEvents out | entries @/lib/ai (client-safe, aiConfig) and @/lib/ai/server (getAnthropicClient, runAgent, createAgentSSEResponse)
use: always
change: counterpart = src/config/lib/ai.config.ts (@lib-config/ai: model, maxIterations, maxTokensPerStep) | runAgent options override it per call
rules:
using:
- shared_client: every AI capability uses the shared client getAnthropicClient, never its own
- tool_input_untrusted: a tool's `run` input is model output → validate it with zod | the agent designs its tools' safety boundary (the runtime only guarantees nothing beyond the given tools)
- prompt_stable_first: put the stable prompt part (role, tool policy) first and variable parts last (prompt cache = prefix match) | operator-editable instructions = stable prompt + a suffix resolved per request (\<domain or lib\>/plugs/dbAgentSuffixProviders/)
- ui_forward_compat: a UI ignores unknown event types and unknown `v`
- done_is_last: `agent.done` always ends a turn | `agent.error` reports and is still followed by `agent.done`
- server_only_lazy_client: Anthropic callers are server-only and create the client lazily (getAnthropicClient): a missing ANTHROPIC_API_KEY fails at call time, never at import
- structured_by_tool_schema: structured output = a tool's JSON Schema the model must fill, never parsing free text
editing:
- protocol_versioning: an optional field may be added within a version | a meaning change or removal bumps AGENT_PROTOCOL_VERSION and keeps the old type
- no_sampling_params: the runtime never sends temperature / top_p / top_k
- stateless_runtime: conversations are stateless (the client holds history) | persistence or sessions are designed as an extension of this runtime
- sdk_cast: on an SDK upgrade, remove the ADAPTIVE_THINKING cast once the SDK types support it
read: build a new agent → Usage | events, blocks, tool types → API | config keys → Extension | loop, abort, usage → Internals

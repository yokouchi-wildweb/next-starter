---
paths:
  - "src/lib/aiVision/**"
---
# lib/aiVision
what: image pre-screening with Claude Vision, entry @/lib/aiVision (checkBankTransferReceipt: does an uploaded image look like a bank transfer receipt; strict mode checks sender name, identifier and amount)
use: always
change: none → /order <direct parent>
rules:
using:
- vision_server_only: call it on the server only (the module is server-only; the API key never reaches a client)
- vision_prescreen: the normal-mode result is a pre-screen before human review, not a verdict (amount and payee are not checked)
editing:
- vision_structured: the model answers through a tool with a JSON Schema, never free text parsed afterwards
- vision_lazy_client: importing works without ANTHROPIC_API_KEY; the missing key fails at call time
read: call it, strict mode → Usage | input, result → API | model, structured output → Internals | env, sandbox → Verification

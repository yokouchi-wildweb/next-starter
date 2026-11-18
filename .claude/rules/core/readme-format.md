---
paths:
  - "**/README*.md"
  - "docs/**"
---
# readme-format
> **ROLE**: loaded when writing a README or a doc | holds the README format
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

readers: agents first (sent by a card, or writing to these rules) → headings fixed, one point per item, no code-derivable lists
h2 (this order, these English words; Overview required, the rest only with content): Overview | Usage | API (data shapes) | Extension (config keys, receptacle use) | Internals (mechanism) | Verification | Related
- body language: the repo's behavior.md (Tier1: Japanese) | cards point to an h2, never deeper
size: one file ≤ 20,000 chars | over → split into an existing subfolder's README, else a file named by the h2 in the same folder (API.md, Internals.md), same format, pointer under the same h2 | no repo name in file names
never: the source of a rule (→ core file / card) | work records and how a decision was reached (→ docs/journal/) | plans (→ /order) | why it changed (→ commit body) | file lists
fork_changes: a fork explains its change to an upstream thing in the README of the folder it owns (_components/, the override place)
precedent: Standard Readme fixes a heading order with Install / Contributing / License required → here a fixed agent-facing h2 set, reference split by kind as in Diátaxis (API = reference, Internals = explanation), no install / license

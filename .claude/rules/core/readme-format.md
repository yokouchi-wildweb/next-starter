---
paths:
  - "**/README*.md"
  - "docs/**"
---
# readme-format
> **ROLE**: loaded when writing a README or a doc | holds the README format
> Tier1-owned: forks never edit (gap → /order <direct parent>)

readers: agents first (sent by a card, or writing to these rules) → headings fixed, one point per item, no code-derivable lists
h2 (this order, these English words; Overview required, the rest only with content): Overview | Usage | API (data shapes) | Extension (config keys, receptacle use) | Internals (mechanism) | Verification | Related
- body language: the repo's behavior.md (Tier1: Japanese) | cards point to an h2, never deeper
size: one file ≤ 40,000 chars | split or not = the writer's call each time: split when it reads better, else one file up to 40,000 | a split goes into an existing subfolder's README, else a file named by the h2 in the same folder (API.md, Internals.md), same format, pointer under the same h2 | no repo name in file names
never: the source of a rule (→ core file / card) | work records and how a decision was reached (→ docs/journal/) | plans (→ /order) | why it changed (→ commit body) | file lists
fork_changes: a fork explains its change to an upstream thing in the README of the folder it owns (_components/, the override place)
precedent: Standard Readme fixes a heading order with Install / Contributing / License required → here a fixed agent-facing h2 set, reference split by kind as in Diátaxis (API = reference, Internals = explanation), no install / license

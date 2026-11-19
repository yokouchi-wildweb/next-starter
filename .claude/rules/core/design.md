---
paths:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".claude/rules/**"
  - ".claude/README.md"
---
# design
> **ROLE**: loaded when writing CLAUDE.md, AGENTS.md or anything under .claude/rules/ | holds the map of all core files, the authoring ladder, the card / service / context-file formats, the size lines and who to consult
> Tier1-owned: forks never edit (gap → /order <direct parent>)

map (every core file, loaded by its paths):
- .claude/rules/core/api-routes.md: API_ROUTES detail
- .claude/rules/core/audit.md: AUDIT detail
- .claude/rules/core/backends.md: BACKENDS / SERVERS rules
- .claude/rules/core/change.md: the change types (CHANGE_TYPES)
- .claude/rules/core/client.md: the client layer rules (hooks, stores)
- .claude/rules/core/components.md: COMPONENTS detail
- .claude/rules/core/db.md: the schema registry, the push round trip and DB identifier rules
- .claude/rules/core/design.md: this file
- .claude/rules/core/domain-definition.md: the domain-definition rules (commands, roles, field types, domain config)
- .claude/rules/core/extensions.md: FORK_EXTENSION (judge, guards, want → means, copy and own marks)
- .claude/rules/core/generated.md: DIRECTORY_STRUCTURE code_generation (generated / write-once / hand-owned)
- .claude/rules/core/lib.md: the library rules (CODE_PLACEMENT library)
- .claude/rules/core/notices.md: DOWNSTREAM_NOTICES detail
- .claude/rules/core/ownership.md: who owns what (CORE_FILES, fork_ownership)
- .claude/rules/core/proxy.md: PROXY detail
- .claude/rules/core/readme-format.md: the README format
- .claude/rules/core/receptacles.md: the upstream side of extension points
- .claude/rules/core/screens.md: SCREENS detail
- .claude/rules/core/scripts.md: the scripts placement and rules
- .claude/rules/core/services.md: CRUD_SERVICE (createCrudService) service-side rules
- .claude/rules/core/skills.md: the skill format
- .claude/rules/core/style.md: STYLE_OWNERSHIP detail

## places (what goes where)
- roles: core file = the architecture canon (layers, placement, ownership, each district's role, cross-cutting rules, duties of the calling layer) | card = rules only for that item + pointers to its README | README = API, mechanism, usage, options, examples, never the source of a rule
- duty_by_reach: a duty anyone writing that layer needs, whichever item they pick → the core file of that layer | a duty only for those who chose to use an item → its card's rules using:
- context: this repo's overview and tier-only info → project.md | rules this repo passes to its downstream → its own section of lineage.md (rules only) | business overview → service/ | work rules → behavior.md (no switch values, no env branches) | machine values → repo.json | never copy an ancestor's overview (business reaches you through service/)

## authoring (the ladder: before adding or changing any rule)
- 1 find its place with places above | 2 write it in that file in this file's formats (paths globs: one-level braces only, nested braces never load) | 3 pnpm check rules | 4 /ship (the why goes in the commit body)
- usual path, no order needed: write a card, a README or a service file | add a rule for a place to an existing core file | fix an existing CLAUDE.md item together with its source item | a place you just created: its one line in a core file's paths or in .claude/rules/core/uncovered.txt, in the same commit that creates the place
- window (order first, even for the Tier1 session: /order next-starter; a fork: /order <direct parent>, relayed up by the parent): a CLAUDE.md item or section added, or a key removed or renamed | a core file added, removed, renamed or its paths widened to places that already exist | a new card category | a check or MANDATORY rule binding forks | a clash between rules of different owners
  - a clash you notice while working: never fix one side yourself → the window | no check hunts for clashes
- the window decides: the Tier1 session handling next-starter's inbox + the user's approval (/inbox) | the reason always goes in the commit body (the inbox lives outside the repo)
- coverage: every upstream file and every intake.txt place must hit the paths of an upstream core file or card (pnpm check rules; a fork's own files are not counted) | matched as Claude Code loads rules (** and * also hit dot-named files and folders) | fails in Tier1 only; a fork gets a notice, and one line "cannot verify" when its base version is unreadable
  - a gap → widen the core file that holds that place's rules (a window item, unless the place is new: usual path above) | only a place that truly needs no rule → uncovered.txt with its reason, never a blanket line to quiet the check
- CLAUDE.md over its notify line (size below) → still ship; the shipping session files one condense order to the window (none if one with the same title is open)
- a missing or wrong rule you do not own → /order <direct parent> | until it ships, a provisional rule in your own rules (outside core/) ending with `(order: <id>)`, followed while the order is open, removed when it ships as resolves: (/flux asks)

## cards (.claude/rules/items/<category>/<name>.md)
- category: lib (one per library) | features (one per domain, Tier1 and business) | components (one per public category folder src/components/<Category>/, split only when too large) | no cards for hooks / utils: their common rules live in core files
- who: each repo writes cards only for its own items (an ancestor's item lacking one → /order <direct parent>) | an item with a README or a mandatory rule | Tier1 items must have one, fork items may | plain names, never the repo name | never edit a Tier1 card downstream; a card a middle tier added may be fixed below it | rules forced on downstream → lineage.md
- frontmatter: paths only = the item's folder + its config and declared receptacle places
- body: `# <category>/<name>` then 5 parts in this order, no headings for the parts (a part may take several lines):
  - what: what it is and its entry, 1-2 sentences
  - use: the feature-gate name that carries the item (always = always open) | never copy default values
  - change: the type (replace / overlay / add / placement) + its declaring file | none → /order <direct parent>
  - rules: split into using: and editing: | one rule per line `- <key>: <text>`, keys unique within the card | never clash with CLAUDE.md
  - read: work scene → README h2 (`→ <h2>` = the item's README, `→ <path>.md <h2>` = another file)
- never: a hand-written dependency list | size ≤ 10,000 chars | pnpm check rules checks the format (a Tier1 card fails, a fork's own card notifies)

## service (.claude/rules/service/<business>.md)
- written only by a tier that defines a business (a middle tier or leaf), never by Tier1 | no paths: always loaded | one or more files per tier, named by the business concept, never the repo name
- body: what the service is | its base domains and their relations | main flows | premises and terms | pointers to cards
- an ancestor's file is never edited, deleted or renamed below (ownership check) → /order <direct parent>; add your own business in another file | size ≤ 40,000 chars | not src/business (= business identity values)

## self_files (each repo keeps its own version; a merge never takes the parent's)
- project.md: this repo's overview + tier-only info (Tier1: the maker's duty and stance) | behavior.md: work rules | repo.json: machine values (repo_id, tier, agent policy), flat keys one per line, written only through its command, read only via forkIds.mjs
- lineage.md: one section per tier, rules only, never edit an ancestor's section (→ /order <direct parent>) | own rules: .claude/rules/ outside core/, plain names, never restate core
- a fork's context files are not checked by upstream beyond the self check (file present, parent's version taken in, overview not left as the parent's): the fork tidies them itself

## size (chars, not lines)
- CLAUDE.md: notify 37,000 (still ship; the shipping session files one condense order to the window, none if one with the same title is open) | fail 40,000 (Claude Code warns per file there) | no target: inside the line, a longer CLAUDE.md that holds the needed rules is fine
- one core file, one service file, one README: fail 40,000 | one card: fail 10,000 | no notify line or target for these
- one line ≤ 400 chars in CLAUDE.md, core files, cards, service | never cut a needed line or a blank line to fit a size
- the amount loaded per work scene is not counted or limited

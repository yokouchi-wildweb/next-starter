---
name: order
description: File a one-off work order or check request into a named repo's inbox (this repo too; self = reserving this repo's next task); the receiving repo judges acceptance against its own role with /inbox | When the user asks to send a task or check to a repo, or to reserve a later task for this repo
argument-hint: "<宛先: self | リポ名 | 省略で会話から判断> [quest] [補足メモ(任意)]"
---

role: file an **ORDER** (write a one-off "do this / check this" into a named repo's inbox)

## MAILBOX LAYOUT
- place: `~/.team/orders/` (shared folder on this machine; outside git; real place = `root:` of `mailbox.mjs self`)
- **one inbox per repo**: `<root>/<fork-id>/` (unhandled) and `<fork-id>/done/` (handled)
  - fork-id = `fork_id: <short name>` of that repo's `.claude/rules/project.md` (lowercase, digits, hyphens)
  - undeclared repos (no line / old `-`) use the old name only during migration (origin URL from the host on, `.git` removed, `/` → `--`, lowercase; no origin → `local--<directory name>`)
  - a declared repo's inbox moves from the old-name box when mailbox.mjs reads the name; the old name stays as a link to the new box
- the inbox holds one-off orders only | serial / grouped orders are handled inside a council legate
- the receiving repo reads its inbox with `/inbox` | the filing session checks the state with `/wen`
- **order state** (head `status:`, one value): `open` → `routed` (routed to a council / guild / legate plan; `routed_to:` / `routed_by:` / `routed_at:`) → `taken` (the owner started; `taken_by:` / `taken_at:`) → answer (done / partial / relayed / rejected / withdrawn, to `done/`)
  - transitions are appended to the trailing `## STATUS_LOG` | old orders without `status:` = open | mailbox.mjs refuses taking / answering by non-owners (usage: `.claude/skills/inbox/SKILL.md`, owner guard)
- helper: `node .claude/skills/order/mailbox.mjs <self | from | me | repos | inbox [--quest] | name-check <名前> | route | take | release | unroute | resolve>` (run at the repo root)
  - `from` = the `from:` line of the order being filed | `me` = your own name as written for an owner
  - `route <order> --to=<council <id> | guild:<instance|name> | legate <id>.<k> plan-SS>` = route | `take <order> [--as=]` = take | `release <order>` = let go | `unroute <order>` = take a route back (routed → open; the owner it was routed to or the one who routed it, else `--force=<reason>`)
  - `name-check` = may this name become this repo's fork_id: (no clash with fleet.conf, local repos, existing inboxes; used by /fork-init)
  - `resolve` = answer an order: append the RESOLUTION and move to done/ | env `ORDER_RESOLVED_HOOK` (path of an executable) set → after answering it is called with the done/ order's path (unset → nothing; team tabs use it to notify the sender)
  - `inbox --quest` = quests (`kind: quest`) only | steps: `.claude/skills/inbox/SKILL.md` step 4

## MATERIAL
- the conversation's context so far (= what is wanted has already been discussed)
- args: $ARGUMENTS | first word = target | the word after the target is `quest` → file as a quest (`kind:` below) | the rest = extra notes | starts with a word that is no target → all of it is extra notes, target omitted

## STEPS
1. **get provenance with Bash** (never guess, never assemble by hand): use the `from:` line of `node .claude/skills/order/mailbox.mjs from` as is
   - run in a team (fleet, guild, council) tab → the issuer is that team's role, not the repo (built from the tab's env `TK_TEAM` / `TK_INSTANCE` / `TK_LABEL`)
   - id timestamp: `date +%Y%m%d-%H%M%S`
2. **pick the target inbox**:
   - `self` (or `自分`): `box:` of `node .claude/skills/order/mailbox.mjs self`
   - a repo name: match `repo:` (fork-id) or the directory name of `path:` in `node .claude/skills/order/mailbox.mjs repos`, take its `box:`
   - omitted: decide the target from the conversation, look up the inbox with `repos`
   - not found / several match / the conversation cannot decide: show the candidates and ask with AskUserQuestion; STOP (never send on a guess)
3. compose the order from the conversation and notes into **exactly this schema** (**a machine-to-machine file: English, terse, no prose or tables**; only `title:` is the exception, in Japanese):
   ```
   # ORDER id:<ts>-<slug>
   from: <mailbox.mjs from の値>
   to: <target origin url> | box:<target fork-id>
   date: <ISO8601>
   status: open
   kind: quest   (only when filed as a quest: the `quest` argument, or the requester asked for a quest; omit the line otherwise)
   title: <日本語の短い題(20 文字前後)>
   need: <one line — the work or check requested>
   why: <the situation driving it; for work that should live in the target repo, why it belongs there>
   done_when: <how the receiver can tell it is finished>
   constraints: <compat / must-not-break / perf / deadline | ->
   refs: <files, commits or code locations that show the need>
   notes: <anything else for the receiver | ->
   tried: <means checked — why not enough>   (only for extension requests; omit the line otherwise)
   ```
   - asking for an intake point, a part split or an added value → first check the means in `.claude/rules/core/extensions.md` and write them in `tried:`
   - head of `from:` = the issuer (3 kinds; readers tell them apart with mailbox.mjs `requester`):
     - repo session = `<origin url> | branch:<branch> | cwd:<path>`
     - team role = `<team> <instance> | role:<役職名> | repo:<origin url> | branch:<branch> | cwd:<path>` (e.g. `fleet 20261024-220119 | role:Admiral | …`; repo: = the repo it ran in, for reference)
     - council legate = `council <議題id> | …` (written by the legate itself; no role: field)
   - self-addressed: a later session without this context reads it → write everything known in this conversation into `why:` and `refs:` (how far it was decided, open points, files to read)
   - `<slug>` = a short kebab (English) from need
   - `title:` = a short Japanese title humans read in lists (team launch screens, `mailbox.mjs inbox`) | a noun phrase of about 20 chars saying what is done (e.g. `チャットルームの UID 不一致を直す`) | the list shows title and id side by side → no id or date in the title
   - `kind: quest` = the mark of a quest (an order finished in one `quest <id>` tab) | this field is the only source of the mark: never put a mark like `【★クエスト】` in the title (lists, quest's launch screen and candidate picking read this field)
     - when a quest answers and the sender is a council / guild / quest lead, the team tools notify it automatically (the sender need not write "notify me" in notes)
   - `status:` = `open` at filing | afterwards only mailbox.mjs rewrites it (route → routed, take → taken, release → the state before taking, unroute → open, resolve → to done/ with the RESOLUTION's status (done / partial / relayed / rejected / withdrawn); never by hand)
4. **write the file without asking first** (create the inbox folder if missing) | once the target is fixed, waiting for approval like `この内容で起票していいですか?` is **prohibited** (filing is a plain md file, fixable later by edit / move / delete):
   - path: `<target box>/<ts>-<slug>.md`
5. after writing, report in Japanese:
   - **line 1 = the target**: `宛先: <宛先リポ名>(<理由を短く>)`
   - summary of need / done_when (1-3 lines) + **the saved path (full path; /wen checks the state by this path)**
   - the line:
     ```
     宛先リポで `/inbox` を実行すると受け取れます。このセッションで `/wen` を打つと状況を確かめられます。宛先や内容を直すときはこのファイルを編集・移動します(言ってください)
     ```

## TEMPORARY PERMIT REQUEST (a fork passing an ownership-check violation)
- violations of `pnpm workflow ownership check` that cannot move to an intake point or be reverted (features upstream lacks, upstream bug / perf / security fixes) pass by an order to the direct parent + a temporary permit (`src/lib/forkOwnership/README.md` section `一時許可`)
1. target = the direct parent (TIER of `.claude/rules/project.md`, else the repo of a remote other than origin) | file it by the steps above | need = the violating paths and what upstream needs (intake point, fix) | refs = the check's violation lines and the draft permit line (`<path> upreq:<依頼の番号> base:… head:…`) | why = why the fork needs that edit now
   - a permit request for delete / rename is limited to "please provide an intake that switches it off (feature-gate etc.)"; an addition to an ancestor lib to "please take it into that lib / please add an intake point"
   - never file for upstream debt spots (debt of intake.txt) or orders upstream already accepted (fix orders in its inbox) | use the reason field of the intake.txt debt / the order id as is
2. fill the draft's `<依頼の番号>` and `<理由>` with the filed id, paste it into `.fork-ownership/<fork-id>.permits.txt`, one line per file (several orders on one file → `upreq:<id>,<id>`)
3. commit the permit file, rerun `pnpm workflow ownership check`, confirm the line becomes permitted
4. check the request state with `/wen permits` | resolved (the parent notice's `resolves:`) or rejected → drop the line and move to the intake point or revert

## SELF-ADDRESSED USE
- leave a next task you are not starting now as this repo's pending work (survives closing the conversation; listed by `/inbox`)
- handoff of in-progress work (state, next move) is auto-memory's job | a self-addressed order = a reservation of work not yet started

language: order files = English, structured | reply: Japanese

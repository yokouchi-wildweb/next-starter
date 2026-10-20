# DOWNSTREAM NOTICE id:20261019-153000-journal-owner-naming
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-19T06:30:00Z
severity: action-required
checkpoint: journal-owner-naming
moved: docs/journal/2026-04-21-purchase-type-migration.md -> docs/journal/2026-04-21--next-starter--purchase-type-migration.md; docs/journal/2026-10-18-ui-layers-revision.md -> docs/journal/2026-10-18--next-starter--ui-layers-revision.md
change: docs/journal/ file naming is now `<YYYY-MM-DD>--<owner>--<slug>.md` (owner = name of the repo that wrote the record = last segment of its origin URL, lowercased) and each record starts with a `> owner: <repo>` line. Every tier writes to the same docs/journal/ and upstream records arrive by merge, so the owner in the name and body tells whose history a record is; the date stays first so `ls` keeps one cross-tier timeline. docs/journal/README.md rewritten (purpose first, then owner rule, then division of labor with project.md / README / upreq; the stale `dev_rules` reference removed). Path pattern updated in CLAUDE.md DOCS dated_records, .claude/README.md and .claude/skills/fork-init/project.template.md. Upstream's 2 records renamed (moved:).
why: (1) Without an owner, a fork agent cannot tell an upstream record from its own and may treat upstream history as its own decision basis. (2) Same date+slug from two tiers would collide (add/add) on merge; owner in the name makes collisions structurally impossible.
required_actions:
1. Merge upstream.
2. Fork's .claude/rules/project.md `scope` → `instead:` line: replace `docs/journal/<YYYY-MM-DD>-<slug>.md` with `docs/journal/<YYYY-MM-DD>--<owner>--<slug>.md` (edit only this path; project.md is fork-owned).
3. New journal records from now on follow the new name and owner line. Renaming the fork's existing records is optional; if renamed, repoint links (`grep -rn "docs/journal/" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=.notices .`).
4. Repoint fork-owned links to the 2 upstream records per moved:.
verify: `ls docs/journal` shows the 2 upstream records with `--next-starter--`; the grep in step 3 returns no link to a missing journal file.
manual_steps: -
refs: docs/journal/README.md, CLAUDE.md DOCS dated_records
notes: owner is the plain repo name (short, readable in ls), not the `--`-joined fork-id used by .notices/applied/ and src/lib/CATALOG.md, because the fork-id itself contains `--` and would make the filename ambiguous.
